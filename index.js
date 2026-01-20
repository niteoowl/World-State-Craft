const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Configuration
const TARGET_CHANNEL_ID = process.env.CHANNEL_ID || '1463044793923010675';
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
    console.error('Error: DISCORD_TOKEN is missing from environment variables.');
    process.exit(1);
}

// Discord -> Client
client.on('messageCreate', (msg) => {
    if (msg.channelId === TARGET_CHANNEL_ID && !msg.author.bot) {
        console.log(`Discord Message from ${msg.author.username}: ${msg.content}`);
        io.emit('chatMessage', {
            user: msg.author.username,
            text: msg.content,
            source: 'discord'
        });
    }
});

// Client -> Discord
io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('sendChat', async (data) => {
        try {
            // Broadcast to other web clients
            io.emit('chatMessage', {
                user: data.user,
                text: data.text,
                source: 'web'
            });

            // Send to Discord
            const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
            if (channel) {
                await channel.send(`**${data.user}**: ${data.text}`);
            }
        } catch (error) {
            console.error('Error sending to Discord:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// 기존: client.login('MTQ2MzA0N...'); 
// 변경: (비밀번호 대신 'DISCORD_TOKEN'이라는 이름의 열쇠를 가져오라는 뜻)
client.login(process.env.DISCORD_TOKEN);

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
