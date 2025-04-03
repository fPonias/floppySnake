import { useEffect } from "react";

export default function useMount(once: () => void) {
    return useEffect(once, []);
}