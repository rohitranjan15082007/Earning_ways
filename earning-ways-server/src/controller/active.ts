import prisma from "../config/prisma.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { ErrorResponse, SuccessResponse } from "../utils/response.util.js";

const updateSetting = asyncHandler(async (req, res, next) => {
  const { phoneNumber, email, activeUser, totalUser, location, maxiumEarningReturn } = req.body;

  if (!email && !phoneNumber && !activeUser && !totalUser && !location && maxiumEarningReturn === undefined) {
    return next(new ErrorResponse("At least one field is required", 400));
  }

  const settingConfig = await prisma.setting.findFirst({});

  // Prepare data object, only including defined fields
  const dataToUpdate: any = {};
  if (phoneNumber !== undefined) dataToUpdate.phoneNumber = phoneNumber;
  if (email !== undefined) dataToUpdate.email = email;
  if (activeUser !== undefined) dataToUpdate.activeUser = activeUser;
  if (totalUser !== undefined) dataToUpdate.totalUser = totalUser;
  if (location !== undefined) dataToUpdate.location = location;
  
  if (maxiumEarningReturn !== undefined && maxiumEarningReturn !== "") {
    dataToUpdate.maxiumEarningReturn = Number(maxiumEarningReturn);
  }

  let updatedSetting;
  if (settingConfig) {
    updatedSetting = await prisma.setting.update({
      where: { id: settingConfig.id },
      data: dataToUpdate,
    });
  } else {
    updatedSetting = await prisma.setting.create({
      data: dataToUpdate,
    });
  }

  res.status(updatedSetting.id ? 200 : 201).json({
    success: true,
    data: updatedSetting,
  });
});


export const getSettingData = asyncHandler(async(req, res) => {
  const setting = await prisma.setting.findFirst()
  return SuccessResponse(res, "setting fetched successfully", setting, 200)
})

export  default updateSetting