
# Real-Time Encrypted Chat App (Server-Mediated)

A lightweight real-time chat system built with Node.js, WebSockets, JWT authentication, and a server-mediated architecture. The goal of this project is to understand how messages move across the internet, how authentication works, and how to design a clean backend for real-time communication.

This project is currently in active development.

---

## Features (Planned & In Progress)

- Real-time messaging using WebSockets  
- Server-mediated architecture (central relay server)  
- JWT-based authentication  
- Persistent message storage (MongoDB)  
- User accounts with login & registration  
- Private and public chat support  
- Clean separation of routes, controllers, services, and socket handlers  
- Optional client-side AES encryption for messages (planned)  

---

## Project Structure

```

backend/
├─ src/
│   ├─ server.js            # main HTTP + WebSocket server
│   ├─ routes/              # REST routes (auth, messages)
│   ├─ controllers/         # request controllers
│   ├─ sockets/             # WebSocket event handlers
│   ├─ models/              # Mongoose models (User, Message)
│   ├─ utils/               # helper utilities
│   └─ config/              # env + db setup
├─ .env.example
├─ package.json
└─ README.md

````

A separate `frontend/` folder will be added for the React client.

---

## Tech Stack

- **Backend:** Node.js, Express  
- **Real-time:** WebSocket (`ws` package)  
- **Auth:** JSON Web Tokens (JWT)  
- **Database:** MongoDB + Mongoose  
- **Security:** bcryptjs for password hashing  
- **Env:** dotenv  
- **Dev tooling:** nodemon  

---

## Setup Instructions (Backend)

### 1. Install dependencies

```bash
cd backend
npm install
````

### 2. Create your `.env` file

Add:

```
MONGO_URI=your_mongo_connection_string
JWT_SECRET=your_secret_key
PORT=3000
```

Make sure `.env` is **not** tracked by Git.

### 3. Run the server

```bash
npm run dev
```

The server will start at:

```
http://localhost:3000
```

WebSocket endpoint:

```
ws://localhost:3000?token=YOUR_JWT_HERE
```

---

## Current Status

* Project scaffold created
* WebSocket server set up
* Basic file structure prepared
* Environment variables configured

**Next steps:**

* Implement login/register routes
* Add MongoDB models (User, Message)
* Implement WebSocket authenticated messaging
* Build the React client

---

## Roadmap

* [ ] Authentication (JWT)
* [ ] User model & registration
* [ ] Login + token generation
* [ ] Basic WebSocket message broadcast
* [ ] Message persistence (MongoDB)
* [ ] Private messaging support
* [ ] Rooms/channels
* [ ] Client-side AES encryption (optional)
* [ ] Frontend (React)
* [ ] Deployment (Render / Railway + Vercel)

---

## Purpose of This Project

This project is designed to strengthen understanding of:

* Real-time communication
* WebSocket protocol
* Server-mediated messaging
* Authentication and access control
* Practical backend architecture
* Encryption basics
* Clean separation of concerns in full-stack systems

---

## License

MIT © 2025 Adithya Sivakumar

---


