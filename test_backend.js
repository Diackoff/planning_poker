const io = require('socket.io-client');
const { expect } = require('assert'); // basic assertion

const PORT = 10000;
const URL = `http://localhost:${PORT}`;

const socket = io(URL, {
    autoConnect: false,
    transports: ['websocket']
});

async function runTests() {
    console.log('Starting tests...');

    socket.connect();

    await new Promise((resolve) => {
        socket.on('connect', () => {
            console.log('Connected to server');
            resolve();
        });
    });

    const roomId = 'test-room';
    const userName = 'TestUser';

    // Test Joining Room
    console.log('Testing: JOIN_ROOM');
    socket.emit('JOIN_ROOM', { roomId, userName, role: 'BE', isScrumMaster: true });

    let roomState = await new Promise(resolve => {
        socket.once('ROOM_STATE', (state) => resolve(state));
    });

    if (!roomState) throw new Error('Failed to get ROOM_STATE after join');
    if (roomState.players.length !== 1) throw new Error('Player not added');
    if (roomState.players[0].name !== userName) throw new Error('Player name mismatch');
    console.log('PASS: JOIN_ROOM');

    // Test Adding Feature
    console.log('Testing: ADD_FEATURE');
    socket.emit('ADD_FEATURE', { roomId, name: 'Feature 1' });

    roomState = await new Promise(resolve => {
        socket.once('ROOM_STATE', (state) => resolve(state));
    });

    if (roomState.features.length !== 1) throw new Error('Feature not added');
    if (roomState.features[0].name !== 'Feature 1') throw new Error('Feature name mismatch');
    console.log('PASS: ADD_FEATURE');

    const featureId = roomState.features[0].id;

    // Test Adding Story
    console.log('Testing: ADD_STORY');
    socket.emit('ADD_STORY', { roomId, featureId, storyName: 'Story 1', storyUrl: 'http://test.com' });

    roomState = await new Promise(resolve => {
        socket.once('ROOM_STATE', (state) => resolve(state));
    });

    const story = roomState.features[0].stories[0];
    if (!story) throw new Error('Story not added');
    if (story.name !== 'Story 1') throw new Error('Story name mismatch');
    console.log('PASS: ADD_STORY');

    // Test Select Story
    console.log('Testing: SELECT_STORY');
    socket.emit('SELECT_STORY', { roomId, storyId: story.id });

    roomState = await new Promise(resolve => {
        socket.once('ROOM_STATE', (state) => resolve(state));
    });

    if (roomState.activeStoryId !== story.id) throw new Error('Active story not set');
    console.log('PASS: SELECT_STORY');

    // Test Voting
    console.log('Testing: SEND_VOTE');
    socket.emit('SEND_VOTE', { roomId, vote: 5 }); // 5 is fibonacci

    roomState = await new Promise(resolve => {
        socket.once('ROOM_STATE', (state) => resolve(state));
    });

    const player = roomState.players.find(p => p.name === userName);
    if (player.vote !== 5) throw new Error('Vote not recorded');
    console.log('PASS: SEND_VOTE');

    // Test Reveal
    console.log('Testing: REVEAL_CARDS');
    socket.emit('REVEAL_CARDS', roomId);

    roomState = await new Promise(resolve => {
        socket.once('ROOM_STATE', (state) => resolve(state));
    });

    if (!roomState.revealed) throw new Error('Cards not revealed');
    console.log('PASS: REVEAL_CARDS');

    // Test Scoring
    console.log('Testing: UPDATE_STORY_DATA');
    socket.emit('UPDATE_STORY_DATA', { roomId, storyId: story.id, scores: { BE: 3, FE: 2, QA: 1 } });

    roomState = await new Promise(resolve => {
        socket.once('ROOM_STATE', (state) => resolve(state));
    });

    const updatedStory = roomState.features[0].stories[0];
    if (updatedStory.finalScores.US !== 6) throw new Error('Score calculation failed (3+2+1!=6)');
    console.log('PASS: UPDATE_STORY_DATA');


    console.log('All tests passed!');
    socket.disconnect();
    process.exit(0);
}

runTests().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
