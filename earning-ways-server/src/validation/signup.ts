import zod, { number } from "zod";

export const UserSchema = zod.object({
    fullName: zod.string(),
    email: zod.string(),
    country: zod.string(),
    Phonenumber: zod.string().min(10),
    password: zod.string().min(8),
    refelerCode: zod.string().optional(),
    
});