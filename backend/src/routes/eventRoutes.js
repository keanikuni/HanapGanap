import express from 'express';
import prisma from '../config/prismaClient.js';

const router = express.Router();

// GET all events
router.get('/', async (req, res) => {

});

// create an event
router.post('/', async (req, res) => {
   
});

// update a event 
router.put('/:id', async (req, res) => {
    
});

// deletes a event
router.delete('/:id', async (req, res) => {
    
});

export default router;