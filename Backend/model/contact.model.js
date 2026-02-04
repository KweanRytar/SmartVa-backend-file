import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        companyName: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        position: {
            type: String,
            
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        phoneNumber: {
            type: Number,
            required: true,
            unique: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
)

contactSchema.index({ userId: 1, email: 1 }, { unique: true });
contactSchema.index({ userId: 1, name: 1 });
contactSchema.index({ userId: 1, companyName: 1 });


// set name to constantly be uppercase before saving
contactSchema.pre('save', function (next) {
    this.name = this.name.toUpperCase();
    this.companyName = this.companyName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    this.position = this.position ? this.position.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : '';
    this.email = this.email.toLowerCase();
    next();
});

const Contact = mongoose.model('Contact', contactSchema)

export default Contact;