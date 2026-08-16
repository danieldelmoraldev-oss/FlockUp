const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
// 🔥 NUEVO: Importamos http y socket.io
const http = require('http');
const { Server } = require('socket.io');

require('dotenv').config({ path: path.join(__dirname, '.env') });
console.log("TEST LEYENDO ENV:", process.env.MONGO_URI);

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 NUEVO: Envolvemos express con http para que Socket.io pueda funcionar
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // Permite que el móvil y PC se conecten sin bloqueos
});

// 1. Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🔥 Conectado a MongoDB Atlas'))
  .catch(err => console.error('Error conectando a Mongo:', err));

// ==========================================
// 2. MODELOS DE BASE DE DATOS (ESQUEMAS)
// ==========================================

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // unique: true para no repetir nombres
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // NUEVO: Mochila para guardar a tus amigos
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] 
});
const User = mongoose.model('User', UserSchema);

// NUEVO: Esquema para los Grupos (Bandadas)
const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  inviteCode: { type: String, required: true, unique: true }, // Código de 5 letras
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});
const Group = mongoose.model('Group', GroupSchema);

// 🔥 NUEVO: Modelo para guardar los mensajes del chat
const MessageSchema = new mongoose.Schema({
  chatId: { type: String, required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  time: { type: String, required: true },
  isSystem: { type: Boolean, default: false } // Para diferenciar tus mensajes de los automáticos
});
const Message = mongoose.model('Message', MessageSchema);

// ==========================================
// 3. MIDDLEWARE DE SEGURIDAD (EL VIGILANTE)
// ==========================================
// Esta función lee el token para saber quién hace la petición
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'Acceso denegado. No hay token.' });

  try {
    // Quitamos la palabra "Bearer " si viene incluida
    const verified = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
    req.user = verified; // Guardamos el ID del usuario en la petición
    next();
  } catch (error) {
    res.status(400).json({ message: 'Token no válido' });
  }
};

// ==========================================
// 4. RUTAS DE AUTENTICACIÓN
// ==========================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Comprobar si el correo o el nombre ya existen
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ message: 'El correo ya está en uso' });
    const existingName = await User.findOne({ username });
    if (existingName) return res.status(400).json({ message: 'Ese nombre de piloto ya está cogido' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET);
    res.status(201).json({ token, username: newUser.username });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Usuario no encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.status(200).json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ==========================================
// 5. RUTAS SOCIALES (AMIGOS Y GRUPOS)
// ==========================================

// A) Añadir amigo por nombre de piloto (AMISTAD MUTUA INSTANTÁNEA)
app.post('/api/social/add-friend', verifyToken, async (req, res) => {
  try {
    const { friendUsername } = req.body;
    
    // 1. Buscar si el amigo existe
    const friend = await User.findOne({ username: friendUsername });
    if (!friend) return res.status(404).json({ message: 'No se encontró a ningún piloto con ese nombre' });
    
    // 2. Comprobar que no te añades a ti mismo
    if (friend._id.toString() === req.user.id) return res.status(400).json({ message: 'No puedes añadirte a ti mismo' });

    // 3. Comprobar si ya sois amigos
    const me = await User.findById(req.user.id);
    if (me.friends.includes(friend._id)) return res.status(400).json({ message: 'Este piloto ya está en tu bandada' });

    // 4. GUARDAR EN AMBAS DIRECCIONES (Amistad instantánea)
    // Te añado a mi lista
    me.friends.push(friend._id);
    await me.save();
    
    // Le añado a él mi ID en su lista
    friend.friends.push(me._id);
    await friend.save();
    
    res.status(200).json({ message: `¡Tú y ${friend.username} ya sois amigos en la bandada!` });
  } catch (error) {
    res.status(500).json({ message: 'Error al añadir amigo' });
  }
});

// B) Crear un nuevo grupo
app.post('/api/social/create-group', verifyToken, async (req, res) => {
  try {
    const { groupName } = req.body;
    
    // Generamos un código aleatorio de 5 letras y números (ej: "X7K9P")
    const inviteCode = Math.random().toString(36).substring(2, 7).toUpperCase();

    const newGroup = new Group({
      name: groupName,
      inviteCode: inviteCode,
      members: [req.user.id] // Tú eres el primer miembro automáticamente
    });

    await newGroup.save();

    // 🔥 NUEVO: Creamos el primer mensaje del sistema automáticamente
    const systemMessage = new Message({
      chatId: newGroup._id.toString(),
      senderName: 'FlockUp',
      text: `¡Bandada "${groupName}" creada! Comparte este código secreto para que otros se unan: ${inviteCode}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: true
    });
    await systemMessage.save();

    res.status(201).json({ 
      message: 'Bandada creada con éxito', 
      // 🔥 NUEVO: Devuelvo el objeto "group" entero para que el frontend te meta al chat directamente
      group: {
        id: newGroup._id.toString(),
        name: newGroup.name,
        type: 'group',
        inviteCode: newGroup.inviteCode,
        avatar: '🔥'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la bandada' });
  }
});

// C) Unirse a un grupo mediante código
app.post('/api/social/join-group', verifyToken, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    
    // 1. Buscar grupo por código (ignorando mayúsculas/minúsculas)
    const group = await Group.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!group) return res.status(404).json({ message: 'Código secreto incorrecto o caducado' });

    // 2. Comprobar si ya estás dentro
    if (group.members.includes(req.user.id)) {
      return res.status(400).json({ message: 'Ya eres miembro de esta bandada' });
    }

    // 3. Meterte en el grupo
    group.members.push(req.user.id);
    await group.save();

    res.status(200).json({ message: `¡Te has unido a ${group.name} con éxito!` });
  } catch (error) {
    res.status(500).json({ message: 'Error al unirse a la bandada' });
  }
});

// D) Descargar mis grupos y amigos (Para cargar la pantalla Social)
app.get('/api/social/my-chats', verifyToken, async (req, res) => {
  try {
    // 1. Buscar al usuario y rellenar los datos de sus amigos
    const me = await User.findById(req.user.id).populate('friends', 'username');
    
    // 2. Buscar las bandadas (grupos) donde estoy metido
    const myGroups = await Group.find({ members: req.user.id });

    // 3. Formatear los datos para que el Frontend los lea fácilmente
    const chats = [];

    // Añadir amigos a la lista
    me.friends.forEach(friend => {
      chats.push({
        id: friend._id.toString(),
        name: friend.username,
        type: 'direct',
        lastMessage: 'Toca para abrir el chat',
        time: 'Ahora',
        avatar: '👨‍✈️',
        hasActiveRoute: false
      });
    });

    // Añadir grupos a la lista
    myGroups.forEach(group => {
      chats.push({
        id: group._id.toString(),
        name: group.name,
        type: 'group',
        lastMessage: `Código secreto: ${group.inviteCode}`,
        time: 'Ahora',
        avatar: '🔥',
        hasActiveRoute: false
      });
    });

    res.status(200).json(chats);
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar la bandada' });
  }
});

// 🔥 NUEVO: E) Ruta para descargar el historial de mensajes al abrir un chat
app.get('/api/social/messages/:chatId', verifyToken, async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId }).sort({ _id: 1 });
    res.status(200).json(messages);
  } catch (error) { 
    res.status(500).json({ message: 'Error cargando mensajes' }); 
  }
});

// ==========================================
// 🔥 NUEVO: 6. LÓGICA DE SOCKET.IO (EL CHAT EN TIEMPO REAL)
// ==========================================
io.on('connection', (socket) => {
  console.log(`🔌 Piloto conectado al Socket: ${socket.id}`);

  // Cuando un usuario abre un chat, se une a la "habitación"
  socket.on('join_room', (chatId) => {
    socket.join(chatId);
  });

  // Cuando un usuario envía un mensaje
  socket.on('send_message', async (data) => {
    // data = { chatId, senderName, text, time }
    try {
      // 1. Lo guardamos en MongoDB
      const newMessage = new Message(data);
      await newMessage.save();
      
      // 2. Lo rebotamos a todos los que estén en esa habitación (incluyéndote a ti)
      io.to(data.chatId).emit('receive_message', data);
    } catch (error) {
      console.error("Error guardando mensaje:", error);
    }
  });
  
  socket.on('typing', (data) => {
    socket.to(data.roomId).emit('display_typing', data);
  });

  socket.on('stop_typing', (data) => {
    socket.to(data.roomId).emit('hide_typing', data);
  });
  
  // 🔥 NUEVO: El radar multijugador
  // Recibe la posición de un coche y la rebota a su convoy
  socket.on('update_location', (data) => {
    // data contiene: roomId, username, coords, bearing, speed
    socket.to(data.roomId).emit('convoy_location_update', data);
  });

  socket.on('disconnect', () => {
    console.log('❌ Piloto desconectado');
  });
});

// ==========================================
// 7. ARRANQUE DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 5000;
// 🔥 IMPORTANTE: Arrancamos `server.listen` en lugar de `app.listen` para que funcionen los Sockets
server.listen(PORT, () => console.log(`🚀 Servidor y Sockets corriendo en puerto ${PORT}`));