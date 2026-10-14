const { mongoose } = require('../db');

const roomSchema = new mongoose.Schema(
  {
    room_number: {
      type: String, required: true, unique: true, trim: true,
    },
    room_type_id: {
      type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', default: null,
    },
    // Denormalised string kept for fast filter/search without always populating
    room_type: { type: String, trim: true, default: '' },

    housekeeping_status: {
      type: String,
      enum: ['Clean', 'Dirty', 'Inspected'],
      default: 'Clean',
    },
    maintenance_status: {
      type: String,
      enum: ['Active', 'OOO', 'OOS'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

// Virtual: is this room sellable right now?
roomSchema.virtual('is_sellable').get(function () {
  return this.maintenance_status === 'Active' && this.housekeeping_status === 'Inspected';
});

module.exports = mongoose.model('Room', roomSchema);
