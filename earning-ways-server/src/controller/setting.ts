// import prisma from "../config/prisma.js";
// import { asyncHandler } from "../middleware/error.middleware.js";
// import { ErrorResponse } from "../utils/response.util.js";

// const updateSetting = asyncHandler(async (req, res, next) => {
//   const { phoneNumber, email, activeUser, totalUser } = req.body;

//   if (!email && !phoneNumber && !activeUser && !totalUser) {
//     return next(new ErrorResponse("At least one field is required", 400));
//   }

//   const settingConfig = await prisma.setting.findFirst({});

//   let updatedSetting;
//   if (settingConfig) {
//     updatedSetting = await prisma.setting.update({
//       where: { id: settingConfig.id },
//       data: {
//         phoneNumber,
//         email,
//         activeUser,
//         totalUser,
//       },
//     });
//   } else {
//     updatedSetting = await prisma.setting.create({
//       data: {
//         phoneNumber,
//         email,
//         activeUser,
//         totalUser,
//       },
//     });
//   }

//   res.status(updatedSetting.id ? 200 : 201).json({
//     success: true,
//     data: updatedSetting,
//   });
// });

// export default  updateSetting
