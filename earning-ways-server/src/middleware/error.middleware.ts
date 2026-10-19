import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { statusCode } from "../types/types.js";
import { ErrorResponse } from "../utils/response.util.js";
import { zodError } from "../validation/index.js";

const errorMiddleware = (
  err: ErrorResponse,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.message ||= "Internal Server Error";
  err.statusCode ||= 500;

  if (err.name === "CastError") err.message = "Invalid ID";
  if ("code" in err && err.code === "P2025") {
    err.message = "Item not found";
  }

  // handle Zod error
  if (err instanceof ZodError) {
    const zodErr = zodError(err);
     res.status(statusCode.Bad_Request).json({
      success: false,
      message: "Validation Error",
      errors: zodErr,
    });
  }else {
    // A 4xx message is written for the client. A 5xx message is not: it can
    // carry driver/Prisma internals, so it is logged and replaced.
    const status = err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) {
      console.error("Unhandled API error:", err);
      res.status(status).json({ success: false, message: "Internal Server Error" });
      return;
    }
    res.status(status).json({
      success: false,
      message: err.message,
    });
  }  
};


export default errorMiddleware;


type AsyncHandlerFunction<TReq extends Request> = (
  req: TReq,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler =
  <TReq extends Request>(fn: AsyncHandlerFunction<TReq>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as TReq, res, next)).catch(next);
  };



