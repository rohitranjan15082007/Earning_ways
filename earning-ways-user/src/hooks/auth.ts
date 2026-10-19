// hooks/auth.ts (updated)
import { useEffect, useState } from "react"

interface User {
  id: string;
  name?: string | null;
  email: string;
  // Add other fields as needed
}

export const getAuth = () => {
    const [token, setToken] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const storedToken = localStorage.getItem("token");
        const storedUserId = localStorage.getItem("userId");

        setToken(storedToken);
        setUserId(storedUserId);
    }, []);
    return { token, userId };
}