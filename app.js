require('dotenv').config();
const path = require('path');
const fs = require('fs');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const { graphqlHTTP } = require('express-graphql');

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');

const clearImage = require('./helpers/file');

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, new Date().toISOString() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// app.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
app.use(bodyParser.json()); // application/json
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single('image')
);
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'OPTIONS, GET, POST, PUT, PATCH, DELETE'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if(req.method === 'OPTIONS'){
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

app.put('/post-image',(req,res,next)=>{
  if(!req.isAuth){
    const error = new Error('Not authenticated.');
    error.statusCode = 401;
    throw error;
  }
  if(!req.file){
    return res.status(200).json({message:"No file provided"});
  }
  if(req.body.oldPath){
    clearImage(req.body.oldPath);
  }
  return res.status(201).json({message:"File stored", filePath: req.file.path});
})


app.use('/graphql',graphqlHTTP({
  schema: graphqlSchema,
  rootValue: graphqlResolver,
  graphiql: true, // This provide a tool on browser to test our data flow graph.
  customFormatErrorFn(err) {
    if(!err.originalError){
      return err;
    }
    const data = err.originalError.data;
    const message = err.message || 'An error occurred.';
    const code = err.originalError.statusCode || 500;
    return { message: message, statusCode: code, data: data };
  }
}));

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(result => {
    app.listen(process.env.PORT || 8000);
    console.log('Server running and database connected successfully');
  })
  .catch(err => console.log(err));


