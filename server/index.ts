import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'

const app = express()
const server = http.createServer(app)

app.use(cors())
app.use(express.json())

interface Message {
  sender: string
  text: string
  time: string
}

interface RoomData {
  users: string[]
  messages: Message[]
}

const rooms: Record<string, RoomData> = {}
const socketToUser: Record<string, { room: string; username: string }> = {}

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

io.on('connection', socket => {
  console.log('User connected:', socket.id)

  socket.on('join_room', ({ username, room }: { username: string; room: string }) => {
    socket.join(room)

    if (!rooms[room]) {
      rooms[room] = { users: [], messages: [] }
    }

    if (!rooms[room].users.includes(username)) {
      rooms[room].users.push(username)
    }

    socketToUser[socket.id] = { room, username }

    // Send full room data (including past messages)
    io.to(room).emit('room_data', rooms[room])
  })

  socket.on('send_message', ({ room, sender, text }: { room: string; sender: string; text: string }) => {
    const msg: Message = {
      sender,
      text,
      time: new Date().toLocaleTimeString()
    }

    if (rooms[room]) {
      rooms[room].messages.push(msg)
      io.to(room).emit('receive_message', msg) // 👈 live update
    }
  })

  socket.on('get_rooms', (callback: (rooms: string[]) => void) => {
    callback(Object.keys(rooms))
  })

  socket.on('disconnect', () => {
    const userData = socketToUser[socket.id]
    if (userData) {
      const { room, username } = userData
      const userList = rooms[room]?.users
      if (userList) {
        rooms[room].users = userList.filter(u => u !== username)
        io.to(room).emit('room_data', rooms[room])
      }
      delete socketToUser[socket.id]
    }

    console.log('User disconnected:', socket.id)
  })
})

server.listen(3001, () => {
  console.log('Server running on http://localhost:3000')
})
