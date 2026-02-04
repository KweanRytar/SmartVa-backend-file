import crypto from 'crypto';

export const generateSixDigitToken = () => {
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = parseInt(randomBytes.toString('hex'), 16);
    
    return (randomNumber % 900000) + 100000;
}

export const generateVerifyToken = () => {
    return generateSixDigitToken();
}


