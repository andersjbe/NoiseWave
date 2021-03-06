const { User, Song, Comment } = require("../db/models");
const Sequelize = require("../db/models/index").Sequelize;
const Op = Sequelize.Op;
const {
  asyncHandler,
  modelNotFound,
  handleValidationErrors,
} = require("../utils");


const express = require("express");
const multer = require("multer");
const multerS3 = require("multer-s3");
const AWS = require("aws-sdk");
const { awsKeys } = require("../config");

const router = express.Router();
//setting AWS credentials and initializing aws-sdk object instance
// remember to import keys from config: const { awsKeys } = require('./config');
AWS.config = new AWS.Config();
AWS.config.accessKeyId = awsKeys.IAM_ACCESS_ID;
AWS.config.secretAccessKey = awsKeys.IAM_SECRET;
const S3 = new AWS.S3();

//setting up direct stream to s3 bucket using multer and multer-s3
const upload = multer({
  storage: multerS3({
    s3: S3,
    bucket: "noisewave",
      key: function (req, file, cb) {
        cb(null, file.originalname);
      },
    }),
  });

  const userNotFound = modelNotFound("User");
  const songNotFound = modelNotFound("Song");
  
  router.get(
  "/users/:id(\\d+)",
  asyncHandler(async (req, res, next) => {
    const userId = req.params.id;
    const user = await User.findByPk(userId, { include: ["Likes", "Songs"] });
    if (!user) {
      next(userNotFound());
      return;
    } else {
      return res.json({ user });
    }
  })
);

router.get(
  "/songs/:id(\\d+)",
  asyncHandler(async (req, res, next) => {
    const songId = req.params.id;
    const song = await Song.findByPk(songId, {
      include: [{ model: User }, { model: Like }, { model: Comment }],
    });
    if (!song) {
      next(songNotFound());
      return;
    } else {
      return res.json({ song });
    }
  })
);

router.delete(
  "/songs/:id(\\d+)",
  asyncHandler(async (req, res, next) => {
    const songId = req.params.id;
    const song = await Song.findByPk(songId);
    if (!song) {
      next(songNotFound());
      return;
    } else {
      await song.destroy();
      res.status(200);
    }
  })
);

router.get(
  "/search/users/:string",
  asyncHandler(async (req, res) => {
    const query = req.params.string;

    const matchingUsers = await User.findAll({
      where: {
        username: {
          [Op.iLike]: `%${query}%`,
        },
      },
    });
    return res.json(matchingUsers);
  })
);

router.get(
  "/search/songs/:string",
  asyncHandler(async (req, res) => {
    const query = req.params.string;

    const matchingSongs = await Song.findAll({
      where: {
        [Op.or]: {
          title: {
            [Op.iLike]: `%${query}%`,
          },
          artist: {
            [Op.iLike]: `%${query}%`,
          },
          album: {
            [Op.iLike]: `%${query}%`,
          },
          genre: {
            [Op.iLike]: `%${query}%`,
          },
        },
      },
    });
    // console.log(matchingSongs);
    return res.json(matchingSongs);
  })
);

module.exports = router;
