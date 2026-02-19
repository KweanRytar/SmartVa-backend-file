import express from 'express';
    import { getAllEvents, updateEvent, cancelEvent, getEventById, getEventByName, createEvent, getEventForTheDay,  getDashboardNotifications, getBusyTime, getEvents } from '../controller/event.controller.js'
import { authenticate } from '../middlewares/authenticate.js';
const routes = express.Router();
routes.get('/notify/', authenticate, getDashboardNotifications)
routes.get('/eventName/:name', authenticate, getEventByName);
routes.get('/events4DDay/', authenticate, getEventForTheDay );
routes.get('/busy/busyTime/', authenticate, getBusyTime)

routes.get('/', authenticate, getEvents);
routes.get('/allEvents', authenticate, getAllEvents);
routes.post('/', authenticate, createEvent);
routes.put('/:id', authenticate, updateEvent);
routes.get('/:id', authenticate, getEventById);

routes.delete('/:id', authenticate, cancelEvent);



export default routes;