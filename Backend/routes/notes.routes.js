import express from 'express';
import {createnote, getallnotes, editnote, deletenote, findnotebytitle} from '../controller/notes.controller.js'
import { authenticate } from '../middlewares/authenticate.js';

const router = express.Router();

router.post('/createnote', authenticate, createnote);
router.get('/getallnotes', authenticate, getallnotes);
router.put('/editnote/:id', authenticate, editnote);
router.delete('/deletenote/:id', authenticate, deletenote);
router.get('/findnote/:title', authenticate, findnotebytitle);

export default router;
