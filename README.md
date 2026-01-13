# Planning Poker Pro

A real-time collaborative tool for agile teams to estimate user stories with discipline-based scoring (Backend, Frontend, QA).

## Features
- **Multi-room Support**: Generate unique links for different teams.
- **Scrum Master Mode**: Dedicated controls for backlog management and card revealing.
- **Discipline Scoring**: Independent estimation for BE, FE, and QA with automatic US (User Story) sum calculation.
- **Jira Integration**: Attach and edit Jira ticket links directly in the story.
- **Live Sync**: Powered by Socket.io for instantaneous updates across all participants.

## Local Setup
1. Install [Node.js](https://nodejs.org/).
2. Run `npm install` to install dependencies (express, socket.io).
3. Start the server: `node server.js`.
4. Open `index.html` in your browser.

## Deployment
This app is ready to be deployed on platforms like **Render**, **Heroku**, or **DigitalOcean**. 
*Note: Remember to update the socket URL in `index.html` to your production domain.*