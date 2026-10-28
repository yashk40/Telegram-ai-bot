
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Health check & setup dashboard
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(
        ` Telegram AI Bot is running!\n\n` +
        ` Status: Active\n` +
        ` AI Binding: ${env.AI ? 'Connected' : 'Missing (bind env.AI)'}\n` +
        ` KV Memory: ${env.CHAT_HISTORY ? 'Enabled' : 'Disabled (optional)'}\n` +
        ` Model: ${env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct'}\n\n` +
        `Quick Setup:\n` +
        `Visit ${url.origin}/set-webhook to link this Worker to your Telegram bot.`,
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    }

    // 2. Helper endpoint to set up Telegram Webhook in one click

    if (request.method === 'GET' && url.pathname === '/set-webhook') {
      if (!env.TELEGRAM_BOT_TOKEN) {
        return new Response('Error: TELEGRAM_BOT_TOKEN secret is not set in Worker environment variables.', { status: 400 });
      }

      const webhookUrl = `${url.origin}/webhook`;
      const secretToken = env.TELEGRAM_SECRET_TOKEN || '';

      const setWebhookUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`;
      const payload = {
        url: webhookUrl,
        allowed_updates: ['message'],
        ...(secretToken ? { secret_token: secretToken } : {})
      };

      try {
        const response = await fetch(setWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        return new Response(JSON.stringify(result, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(`Failed to set webhook: ${err.message}`, { status: 500 });
      }
    }

    // 3. Helper endpoint to view Telegram webhook status
    if (request.method === 'GET' && url.pathname === '/webhook-info') {
      if (!env.TELEGRAM_BOT_TOKEN) {
        return new Response('Error: TELEGRAM_BOT_TOKEN is not configured.', { status: 400 });
      }
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
      const info = await response.json();
      return new Response(JSON.stringify(info, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Telegram Webhook Handler (POST /webhook or POST /)

    if (request.method === 'POST') {
      // Validate optional secret token for security
      if (env.TELEGRAM_SECRET_TOKEN) {
        const clientToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (clientToken !== env.TELEGRAM_SECRET_TOKEN) {
          return new Response('Unauthorized', { status: 401 });
        }
      }

      try {
        const update = await request.json();

        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(handleTelegramUpdate(update, env));
        } else {
          await handleTelegramUpdate(update, env);
        }

        return new Response('OK', { status: 200 });
      } catch (err) {
        console.error('Error handling Telegram webhook:', err);
        return new Response('OK', { status: 200 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};


async function handleTelegramUpdate(update, env) {

  const message = update?.message;
  if (!message || !message.text) {
    return;
  }

  const chatId = message.chat.id;
  const userText = message.text.trim();
  const userName = message.from?.first_name || 'there';
  const botToken = env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN is not configured!');
    return;
  }


  if (userText === '/start') {
    const welcomeText =
      ` Hello ${userName}!\n\n` +
      `I am an AI assistant running 100% serverlessly on *Cloudflare Workers* and powered by *Workers AI* (Llama 3.1)!\n\n` +
      `Commands:\n` +
      ` Ask me anything directly in chat\n` +
      ` /reset - Clear our conversation history\n` +
      ` /help - Show this help message`;
    await sendTelegramMessage(botToken, chatId, welcomeText);
    return;
  }


  if (userText === '/help') {
    const helpText =
      ` *Telegram AI Bot Help*\n\n` +
      ` Send any text prompt to chat with the AI model.\n` +
      ` Type /reset to clear previous conversation memory.\n` +
      ` Model: \`${env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct'}\``;
    await sendTelegramMessage(botToken, chatId, helpText);
    return;
  }

  if (userText === '/reset') {
    if (env.CHAT_HISTORY) {
      await env.CHAT_HISTORY.delete(`history_${chatId}`);
    }
    await sendTelegramMessage(botToken, chatId, ' Conversation history has been reset. What would you like to talk about next?');
    return;
  }


  await sendChatAction(botToken, chatId, 'typing');

  try {
    let history = [];
    if (env.CHAT_HISTORY) {
      const stored = await env.CHAT_HISTORY.get(`history_${chatId}`, 'json');
      if (Array.isArray(stored)) {
        history = stored;
      }
    }

    const systemPrompt = env.SYSTEM_PROMPT ||
      'You are a helpful, concise, and smart AI assistant communicating over Telegram. Format your answers neatly using Markdown where appropriate.';

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userText }
    ];

    const model = env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';
    const aiResponse = await env.AI.run(model, { messages });
    const replyText = aiResponse?.response?.trim() || "I apologize, but I couldn't generate a response. Please try again.";

    if (env.CHAT_HISTORY) {
      const updatedHistory = [
        ...history,
        { role: 'user', content: userText },
        { role: 'assistant', content: replyText }
      ].slice(-8);


      await env.CHAT_HISTORY.put(`history_${chatId}`, JSON.stringify(updatedHistory), {
        expirationTtl: 259200
      });
    }

    const chunks = splitMessage(replyText, 4000);
    for (const chunk of chunks) {
      await sendTelegramMessage(botToken, chatId, chunk);
    }
  } catch (error) {
    console.error('AI generation error:', error);
    await sendTelegramMessage(
      botToken,
      chatId,
      ' Sorry, I encountered an error while processing your request. Please try again in a moment.'
    );
  }
}


async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });

    if (!res.ok) {
      const err = await res.json();
      if (err.description && err.description.includes('can\'t parse entities')) {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: text
          })
        });
      }
    }
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
  }
}


async function sendChatAction(botToken, chatId, action = 'typing') {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        action: action
      })
    });
  } catch (err) {

  }
}


function splitMessage(text, maxLength = 4000) {
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }


    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {

      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {

      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}
