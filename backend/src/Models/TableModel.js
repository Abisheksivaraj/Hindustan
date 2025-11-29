const mongoose = require("mongoose");

const generatedLabelSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    codeType: {
      type: String,
      required: true,
      enum: ["barcode", "qrcode", "datamatrix"],
    },
    configId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabelConfig",
    },
    printHistoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PrintHistory",
    },
    baseName: {
      type: String,
      required: true,
      index: true,
    },
    sequenceNumber: {
      type: Number,
      required: true,
    },
    isPrinted: {
      type: Boolean,
      default: false,
    },
    printedAt: {
      type: Date,
      default: null,
    },
    printCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["generated", "printed", "error"],
      default: "generated",
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for faster queries
generatedLabelSchema.index({ baseName: 1, sequenceNumber: 1 });
generatedLabelSchema.index({ isPrinted: 1, createdAt: -1 });

// Static method to check if code exists
generatedLabelSchema.statics.codeExists = async function (code) {
  const label = await this.findOne({ code });
  return !!label;
};

// Static method to get labels by base name
generatedLabelSchema.statics.getByBaseName = async function (
  baseName,
  limit = 100
) {
  return await this.find({ baseName }).sort({ sequenceNumber: 1 }).limit(limit);
};

// Method to mark as printed
generatedLabelSchema.methods.markAsPrinted = async function () {
  this.isPrinted = true;
  this.printedAt = new Date();
  this.printCount += 1;
  this.status = "printed";
  return await this.save();
};

const GeneratedLabel = mongoose.model("GeneratedLabel", generatedLabelSchema);

module.exports = GeneratedLabel;
