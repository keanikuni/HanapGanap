import express from 'express';
import path, { dirname } from 'path'
import { fileURLToPath } from 'url';
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

app.listen(PORT, () => {
    console.log(`Server has started on http://localhost:${PORT}`);
});

