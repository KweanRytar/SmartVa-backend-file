import express from 'express';
import { getAllDocuments, updateDocument, deleteDocument, createDocument, getDocumentById,  addDocumentResponse } from '../controller/document.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
const routes = express.Router();

routes.get('/getAllDocuments', authenticate, getAllDocuments); // handles GET /document
routes.get('/:id', authenticate, getDocumentById); // handles GET /document/:id
routes.post('/', authenticate, createDocument); // handles POST /document
routes.post('/response/:id', authenticate, addDocumentResponse); // handles POST /document/response/:id
routes.put('/:id', authenticate, updateDocument); // handles PUT /document/:id
routes.delete('/:id', authenticate, deleteDocument); // handles DELETE /document/:id



export default routes;  