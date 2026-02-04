import express from 'express';
import { register, verifyEmail, login, logout, requestToResetPassword, confirmResetToken, resetPassword, getUserDetails, updateUserDetails } from '../controller/user.controller.js';
import limiter from '../middlewares/rateLimiting.js';
import { authenticate } from '../middlewares/authenticate.js';

const routes = express.Router();

routes.post('/register', limiter , register);
routes.post('/verify-email', limiter , verifyEmail);
routes.post('/login', limiter , login);

routes.post('/request-reset-password', limiter , requestToResetPassword);
routes.post('/confirm-reset-token', limiter , confirmResetToken);
routes.post('/reset-password', limiter , resetPassword);
routes.put('/updateUser', authenticate, updateUserDetails);
routes.get('/getUser', authenticate, getUserDetails);


export default routes;