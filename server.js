const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let roomState = {
    players: [],
    revealed: false,
    estimationFinished: false,
    features: [],
    activeStoryId: null,
    totals: { BE: 0, FE: 0, QA: 0 }
};

const calculateTotals = () => {
    const totals = { BE: 0, FE: 0, QA: 0 };
    roomState.features.forEach(f => {
        f.stories.forEach(s => {
            if (s.finalScores) {
                totals.BE += Number(s.finalScores.BE || 0);
                totals.FE += Number(s.finalScores.FE || 0);
                totals.QA += Number(s.finalScores.QA || 0);
            }
        });
    });
    return totals;
};

io.on('connection', (socket) => {
    socket.emit('ROOM_STATE', roomState);

    socket.on('JOIN_ROOM', ({ userName, role, isScrumMaster }) => {
        roomState.players.push({ id: socket.id, name: userName, role: isScrumMaster ? 'SM' : role, isScrumMaster: !!isScrumMaster, vote: null });
        io.emit('ROOM_STATE', roomState);
    });

    socket.on('ADD_FEATURE', (name) => {
        roomState.features.push({ id: Date.now(), name, stories: [] });
        io.emit('ROOM_STATE', roomState);
    });

    socket.on('ADD_STORY', ({ featureId, storyName, storyUrl }) => {
        const feature = roomState.features.find(f => f.id === featureId);
        if (feature) {
            feature.stories.push({ id: Date.now(), name: storyName, url: storyUrl || '', finalScores: { US: 0, BE: 0, FE: 0, QA: 0 } });
            io.emit('ROOM_STATE', roomState);
        }
    });

    // Исправленный метод обновления стори (URL и оценки вместе)
    socket.on('UPDATE_STORY_DATA', ({ storyId, scores, url }) => {
        roomState.features.forEach(f => {
            const story = f.stories.find(s => s.id === storyId);
            if (story) {
                if (scores) {
                    const sum = Number(scores.BE || 0) + Number(scores.FE || 0) + Number(scores.QA || 0);
                    story.finalScores = { ...scores, US: sum };
                }
                if (url !== undefined) story.url = url;
            }
        });
        roomState.totals = calculateTotals();
        io.emit('ROOM_STATE', roomState);
        fs.writeFileSync('history.json', JSON.stringify(roomState.features, null, 2));
    });

    socket.on('SELECT_STORY', (storyId) => {
        roomState.activeStoryId = storyId;
        roomState.revealed = false;
        roomState.estimationFinished = false;
        roomState.players.forEach(p => p.vote = null);
        io.emit('ROOM_STATE', roomState);
    });

    socket.on('SEND_VOTE', (vote) => {
        const player = roomState.players.find(p => p.id === socket.id);
        if (player && !player.isScrumMaster && !roomState.estimationFinished) {
            player.vote = vote;
            io.emit('ROOM_STATE', roomState);
        }
    });

    socket.on('REVEAL_CARDS', () => {
        roomState.revealed = true;
        io.emit('ROOM_STATE', roomState);
    });

    socket.on('FINISH_ESTIMATION', () => {
        roomState.estimationFinished = true;
        io.emit('ROOM_STATE', roomState);
    });

    socket.on('disconnect', () => {
        roomState.players = roomState.players.filter(p => p.id !== socket.id);
        io.emit('ROOM_STATE', roomState);
    });
});

server.listen(4000, () => console.log('Server is running on 4000'));