const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config(); // Carregue as variáveis de ambiente do arquivo .env

const PORT = process.env.PORT || 3333;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

admin.initializeApp({
  credential: admin.credential.cert(require(`./${process.env.FIREBASE_SERVICE_ACCOUNT}`)),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});
const app = express();

app.use(express.json());
app.use(cors());

// Middleware de autenticação com Firebase
const authMiddleware = async (req, res, next) => {
  try {
    const idToken = req.headers.authorization;
    if (!idToken) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }
    const user = await admin.auth().verifyIdToken(idToken);
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Autenticação falhou' });
  }
};

// Todas as rotas protegidas por autenticação devem usar o middleware
app.use(authMiddleware);

// Suas rotas protegidas aqui
 app.get('/protegido', (req, res) => {
 const user = req.user;
 res.json({ message: 'Rota protegida', user });
});

// Suas rotas existentes
app.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM curriculos');
    return res.status(200).send(rows);
  } catch (err) {
    return res.status(400).send(err);
  }
});

app.get('/curriculos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const Allcurriculos = await pool.query('SELECT * FROM curriculos WHERE id = ($1)', [id]);
    return res.status(200).send(Allcurriculos.rows);
  } catch (err) {
    return res.status(400).send(err);
  }
});

app.post('/curriculos', async (req, res) => {
  const { nome, email, telefone, formacao, experiencia } = req.body;
  let nomePessoa = '';
  try {
    nomePessoa = await pool.query('SELECT * FROM curriculos WHERE nome = ($1)', [nome]);
    if (!nomePessoa.rows[0]) {
      nomePessoa = await pool.query(
        'INSERT INTO curriculos (nome, email, telefone, formacao, experiencia) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [nome, email, telefone, formacao, experiencia]
      );
    }

    return res.status(200).send(nomePessoa.rows);
  } catch (err) {
    return res.status(400).send(err);
  }
});

app.put('/curriculos/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const updateCurriculo = await pool.query(
      'UPDATE curriculos SET nome = ($1), email = ($2), telefone = ($3), formacao = ($4), experiencia = ($5) WHERE id = ($6) RETURNING *',
      [data.nome, data.email, data.telefone, data.formacao, data.experiencia, id]
    );
    return res.status(200).send(updateCurriculo.rows);
  } catch (err) {
    return res.status(400).send(err);
  }
});

app.delete('/curriculos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deletedCurriculo = await pool.query('DELETE FROM curriculos WHERE id = ($1) RETURNING *', [id]);
    return res.status(200).send({
      message: 'Curriculo successfully deleted',
      deletedCurriculo: deletedCurriculo.rows,
    });
  } catch (err) {
    return res.status(400).send(err);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
