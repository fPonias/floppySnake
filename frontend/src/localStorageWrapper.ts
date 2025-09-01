import { useEffect, useState } from "react";

type Listener = () => void;

class Listenable {
    private listeners: Listener[] = [];

    addListener(listener: Listener) {
        if (this.listeners.indexOf(listener) > -1) { return; }
        this.listeners.push(listener);

        this.trigger();
    }

    removeListener(listener: Listener) {
        const idx = this.listeners.indexOf(listener);
        if (idx == -1) { return; }

        this.listeners.splice(idx, 1);
    }

    trigger() {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

class Storable extends Listenable {
    key: string

    constructor(key: string) {
        super();
        this.key = key;
    }

    get value(): string | null {
        return localStorage.getItem(this.key);
    }

    set value(value: string | null) {
        if (value) {
            localStorage.setItem(this.key, value);
        } else {
            localStorage.removeItem(this.key);
        }

        this.trigger();
    }
}

export enum LocalStorageKeys {
    token,
    name,
    apiToken
}

export const LocalStorageKeysValues = new Map<LocalStorageKeys, string>();
LocalStorageKeysValues.set(LocalStorageKeys.token, "token");
LocalStorageKeysValues.set(LocalStorageKeys.name, "name");
LocalStorageKeysValues.set(LocalStorageKeys.apiToken, "apiToken");


export const useLocalStorage = (key: LocalStorageKeys) => {
    const stor = new Storable(LocalStorageKeysValues.get(key) ?? "token");

    function setter(value: string | null) {
        stor.value = value;
    }

    const [value, setValue] = useState<string | null>(null);

    useEffect(() => {
        const listener = () => {
            setValue(stor.value);
        }

        stor.addListener(listener)

        return () => {
            stor.removeListener(listener);
        }
    })

    return {getter: value, setter: setter};
}