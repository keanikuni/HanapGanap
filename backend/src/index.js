import express from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';


import eventRoutes from './routes/eventRoutes.js';
import authRoutes from './routes/authRoutes.js';

import { IMAGE_DIR } from './middleware/imageMiddleware.js';
import authMiddleware from './middleware/authMiddleware.js';

const app = express();
const PORT = process.env.PORT || 8000;

//middleware 
app.use(express.json());

//Get the file path from the URL of the current module
const __filename = fileURLToPath(import.meta.url);

//Get the directory name from the file path 
const __dirname = dirname(__filename);

// Backend/src -> up two levels -> Frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

//serving up the html file from the /public directory
app.get('/', (req, res) => {
    res.send("welcome to hanap ganap (wala pa laman in development)");
}); 

// Serve uploaded images. Uses the SAME folder Multer saves into
app.use('/uploads', express.static(IMAGE_DIR));

// routes for the login and sign up
app.use('/auth', authRoutes);

// routes for the EVENT
app.use('/events', eventRoutes);

// Handles multer errors such as "file too large"
app.use((err, req, res, next) => {

    if (err instanceof multer.MulterError) { 
        return res.status(400).json({ error: err.message })
    };

    console.error(err);

    res.status(500).json({ error: 'server error' });
});

app.listen(PORT, () => {
    console.log(`Server has started on http://localhost:${PORT}`);
});

