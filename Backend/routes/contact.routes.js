import express from 'express';
import { getAllContacts, updateContact, deleteContact, createContact,getContactById, contactsWithSameCompany, getContactByName } from '../controller/contact.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
const routes = express.Router();

routes.get('/getAllContacts', authenticate, getAllContacts); // handles GET /contact
routes.get('/:id', authenticate, getContactById); // handles GET /contact/:id
routes.post('/', authenticate, createContact); // handles POST /contact
routes.put('/:id', authenticate, updateContact); // handles PUT /contact/:id
routes.delete('/:id', authenticate, deleteContact); // handles DELETE /contact/:id
routes.get('/company/:companyName', authenticate, contactsWithSameCompany)
routes.get('/name/:name', authenticate, getContactByName);

export default routes;
