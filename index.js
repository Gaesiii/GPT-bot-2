require('dotenv/config');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const OpenAI = require('openai');
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

client.on('ready', () => {
    console.log('🤖 The bot is online!');
});

const IGNORE_PREFIX = '!';
const CHANNELS = ['1411402607708340275'];



const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

const MAX_DISCORD_MESSAGE_LENGTH = 2000;

function splitMessage(content, maxLength = MAX_DISCORD_MESSAGE_LENGTH) {
    const parts = [];
    let current = '';

    for (const line of content.split('\n')) {
        if ((current + line).length > maxLength) {
            parts.push(current);
            current = '';
        }
        current += line + '\n';
    }

    if (current) parts.push(current);
    return parts;
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith(IGNORE_PREFIX)) return;
    if (!CHANNELS.includes(message.channelId) && !message.mentions.users.has(client.user.id)) return;

    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 10000);

    let conversation = [];
    conversation.push({
        role: 'system',
        content: `bạn tên là Hẹ Hẹ.
        bạn là một chat bot vui vẻ , giao tiếp thân thiện đời thường , có thể dùng từ nói tục để tự nhiên hơn xíu nhưng đừng lố.
        nếu ai đó hỏi bạn Dịt , zịt hay Thắm có mặp không thì trả lời là Có . vì Dịt , zịt Thắm mặp.
        `
    });

    const PrevMessages = await message.channel.messages.fetch({ limit: 10 });
    PrevMessages.reverse();
    PrevMessages.forEach(msg => {
        if (msg.author.bot && msg.author.id !== client.user.id) return;
        if (msg.content.startsWith(IGNORE_PREFIX)) return;
        const username = msg.author.username.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');
        if (msg.author.id === client.user.id) {
            conversation.push({
                role: 'assistant',
                name: username,
                content: msg.content,
            });
            return;
        }
        conversation.push({
            role: 'user',
            name: username,
            content: msg.content,
        });
    });

    try {
        const response = await openai.chat.completions.create({
            model: 'qwen/qwen3-235b-a22b-07-25:free',
            messages: conversation,
        });

        const reply = response.choices?.[0]?.message?.content;

        if (reply) {
            const chunks = splitMessage(reply);
            for (const chunk of chunks) {
                await message.reply(chunk);
            }

            const musicRegex = /(phát|mở|chơi)\s+nhạc\s*(.*)/i;
            const matched = message.content.match(musicRegex);
            if (matched || /m!p\s+.+/i.test(reply)) {
                const song = matched ? matched[2].trim() : '';
                const mCommand = song ? `m!p ${song}` : reply;

                const voiceChannel = await client.channels.fetch(VOICE_CHANNEL_ID);
                if (voiceChannel && voiceChannel.isVoiceBased()) {
                    joinVoiceChannel({
                        channelId: VOICE_CHANNEL_ID,
                        guildId: voiceChannel.guild.id,
                        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                    });

                    // Gửi lệnh bằng webhook
                    await axios.post(WEBHOOK_URL, {
                        content: mCommand,
                        username: 'Hẹ Hẹ',
                        avatar_url: 'https://i.imgur.com/AfFp7pu.png'
                    });

                    setTimeout(() => {
                        const connection = getVoiceConnection(voiceChannel.guild.id);
                        if (connection) connection.destroy();
                    }, 20000);
                }
            }
        } else {
            message.reply('❌ Không có phản hồi từ AI.');
        }
    } catch (error) {
        console.error('🚫 OpenAI Error:\n', error);
        message.reply('❌ Thử lại sau tí đê , con AI trĩ rồi');
    } finally {
        clearInterval(sendTypingInterval);
    }
});

setInterval(async () => {
    try {
        await axios.get('https://discordbot-44s6.onrender.com');
        await openai.chat.completions.create({
            model: 'meta-llama/llama-4-scout:free',
            messages: [
                { role: 'system', content: 'ping giữ server sống' },
                { role: 'user', content: 'Bạn còn ở đó không?' }
            ]
        });
    } catch (err) {
        console.error('⚠️ Lỗi ping:', err.message);
    }
}, 10 * 60 * 1000);

client.login(process.env.TOKEN);
