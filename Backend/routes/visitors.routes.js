import express, { Router } from 'express'
import {createVisitor, getVisitors, getVisitorByDay, getVisitorByMonth, getVisitorsByWeek, deleteVisitors, getVisitorByName, upDateVisitor, getVisitorById} from '../controller/visitors.controller.js'
import { authenticate } from '../middlewares/authenticate.js';
const routes = express.Router()

routes.post('/', authenticate, createVisitor)

routes.put('/:id', authenticate, upDateVisitor)

routes.get('/getVisitors', authenticate, getVisitors)

routes.get('/:id', authenticate, getVisitorById )

routes.get('/name/:name', authenticate, getVisitorByName)

routes.get('/day/:day', authenticate, getVisitorByDay)

routes.get('/month/:month', authenticate, getVisitorByMonth)


routes.get('/week', authenticate, getVisitorsByWeek)

routes.delete('/:id', authenticate, deleteVisitors)

export default routes