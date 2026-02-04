const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Хранилище комнат в памяти сервера
const rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('JOIN_ROOM', ({ roomId, userName, role, isScrumMaster }) => {
        if (!roomId || !userName) return;
        socket.join(roomId);
        
        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                features: [],
                activeStoryId: null,
                revealed: false,
                estimationFinished: false,
                totals: { BE: 0, FE: 0, QA: 0 }
            };
        }

        // Удаляем старую сессию игрока, если она была
        rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
        
        // Добавляем игрока (имя принудительно делаем строкой)
        rooms[roomId].players.push({
            id: socket.id,
            name: String(userName),
            role: role,
            isScrumMaster: !!isScrumMaster,
            vote: null
        });

        io.to(roomId).emit('ROOM_STATE', rooms[roomId]);
    });

    socket.on('ADD_FEATURE', ({ roomId, name }) => {
        if (!roomId || !name) return;
        const room = rooms[roomId];
        if (room) {
            room.features.push({
                id: Math.random().toString(36).substring(2, 9),
                name: String(name), // Защита от [object Object]
                stories: []
            });
            io.to(roomId).emit('ROOM_STATE', room);
        }
    });

    socket.on('ADD_STORY', ({ roomId, featureId, storyName, storyUrl }) => {
        if (!roomId || !featureId || !storyName) return;
        const room = rooms[roomId];
        if (room) {
            const feature = room.features.find(f => f.id === featureId);
            if (feature) {
                feature.stories.push({
                    id: Math.random().toString(36).substring(2, 9),
                    name: String(storyName), // Защита от [object Object]
                    url: storyUrl ? String(storyUrl) : "",
                    finalScores: { BE: 0, FE: 0, QA: 0, US: 0 }
                });
                io.to(roomId).emit('ROOM_STATE', room);
            }
        }
    });

    socket.on('SELECT_STORY', ({ roomId, storyId }) => {
        if (!roomId || !storyId) return;
        const room = rooms[roomId];
        if (room) {
            room.activeStoryId = storyId;
            room.revealed = false;
            room.estimationFinished = false;
            // Сбрасываем голоса при выборе новой задачи
            room.players.forEach(p => p.vote = null);
            io.to(roomId).emit('ROOM_STATE', room);
        }
    });

    socket.on('SEND_VOTE', ({ roomId, vote }) => {
        if (!roomId || vote === undefined) return;
        const room = rooms[roomId];
        if (room && !room.estimationFinished) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                // Сохраняем ТОЛЬКО число, чтобы не ломать фронтенд объектами
                player.vote = Number(vote);
                io.to(roomId).emit('ROOM_STATE', room);
            }
        }
    });

    socket.on('REVEAL_CARDS', (roomId) => {
        const room = rooms[roomId];
        if (room) {
            room.revealed = true;
            io.to(roomId).emit('ROOM_STATE', room);
        }
    });

    socket.on('UPDATE_STORY_DATA', ({ roomId, storyId, scores, url }) => {
        if (!roomId || !storyId) return;
        const room = rooms[roomId];
        if (room) {
            const story = room.features.flatMap(f => f.stories).find(s => s.id === storyId);
            if (story) {
                if (scores) {
                    story.finalScores = {
                        BE: Number(scores.BE || 0),
                        FE: Number(scores.FE || 0),
                        QA: Number(scores.QA || 0),
                        US: Number(scores.BE || 0) + Number(scores.FE || 0) + Number(scores.QA || 0)
                    };
                    // Пересчитываем общие итоги комнаты
                    room.totals = { BE: 0, FE: 0, QA: 0 };
                    room.features.forEach(f => {
                        f.stories.forEach(s => {
                            room.totals.BE += (s.finalScores.BE || 0);
                            room.totals.FE += (s.finalScores.FE || 0);
                            room.totals.QA += (s.finalScores.QA || 0);
                        });
                    });
                }
                if (url !== undefined) story.url = String(url);
                io.to(roomId).emit('ROOM_STATE', room);
            }
        }
    });

    socket.on('FINISH_ESTIMATION', (roomId) => {
        const room = rooms[roomId];
        if (room) {
            room.estimationFinished = true;
            io.to(roomId).emit('ROOM_STATE', room);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});