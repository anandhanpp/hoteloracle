const { mongoose } = require('../db');

const roomTypeSchema = new mongoose.Schema(
  {
    type_code:  { type: String, required: true, unique: true, uppercase: true, trim: true },
    name:       { type: String, required: true, unique: true, trim: true },
    base_price: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RoomType', roomTypeSchema);
