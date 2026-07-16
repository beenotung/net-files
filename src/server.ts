import express from 'express'
import { print } from 'listening-on'
import socketIO from 'socket.io'
import http from 'http'
import { join } from 'path'
import { env } from './env'
import { object, number, string, ParseResult } from 'cast.ts'

let app = express()
let server = http.createServer(app)
let io = new socketIO.Server(server)

let fileMetaParser = object({
  size: number(),
  type: string(),
  lastModified: number(),
  hash: string({ minLength: 64, maxLength: 64, match: /^[0-9a-fA-F]+$/ }),
})
type FileMeta = ParseResult<typeof fileMetaParser>

// slug -> name -> FileMeta
let rooms: Record<string, Record<string, FileMeta>> = {}

function hasRoom(args: { slug: string; hash: string }) {
  let { slug, hash } = args
  return 'has:' + slug + ':' + hash
}

io.on('connection', socket => {
  socket.on('join', slug => {
    socket.join('slug:' + slug)
    let room = rooms[slug]
    if (room) {
      for (let name in room) {
        let fileMeta = room[name]
        socket.emit('has', { slug, name, ...fileMeta })
      }
    }
  })
  socket.on('leave', slug => {
    let room = rooms[slug]
    if (room) {
      for (let name in room) {
        socket.leave(hasRoom({ slug, hash: room[name].hash }))
      }
    }
    socket.leave('slug:' + slug)
  })
  socket.on('has', data => {
    let { slug, name, ..._fileMeta } = data
    let fileMeta = fileMetaParser.parse(_fileMeta)
    let room = (rooms[slug] ||= {})
    let existing = room[name]
    if (existing && existing.hash !== fileMeta.hash) {
      // Same name overwrite with different content
      socket.leave(hasRoom({ slug, hash: existing.hash }))
    }
    room[name] = fileMeta
    socket.join(hasRoom({ slug, hash: fileMeta.hash }))
    io.to('slug:' + slug).emit('has', data)
  })
  socket.on('remove', ({ slug, name }) => {
    let room = rooms[slug]
    let fileMeta = room?.[name]
    if (!fileMeta) return
    socket.leave(hasRoom({ slug, hash: fileMeta.hash }))
    delete room[name]
  })
  socket.on('want', data => {
    if (!data.hash) return
    let payload = { ...data, from: socket.id }
    io.to(hasRoom({ slug: data.slug, hash: data.hash }))
      .except(socket.id)
      .emit('want', payload)
  })
  socket.on('content', data => {
    if (!data.to) {
      console.warn('dropping content without target peer:', {
        slug: data.slug,
        name: data.name,
      })
      return
    }
    // Only deliver to the peer that requested this chunk
    io.to(data.to).emit('content', data)
  })
})

app.use(express.static(join(__dirname, '..', 'public')))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

server.listen(env.PORT, () => {
  print(env.PORT)
})
