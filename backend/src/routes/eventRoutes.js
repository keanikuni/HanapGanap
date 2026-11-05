import express from 'express';
import prisma from '../config/prismaClient.js';

const router = express.Router();



// GET all events
// http://localhost:8000/events/ 

router.get('/', async (req, res) => {

});

// create an event
// http://localhost:8000/events/ 
router.post('/', async (req, res) => {
   
});

// update a event 
// http://localhost:8000/events/{:id} 
router.put('/:id', async (req, res) => {
    
});

// deletes a event
// http://localhost:8000/events/{:id} 
router.delete('/:id', async (req, res) => {
    
});

export default router;