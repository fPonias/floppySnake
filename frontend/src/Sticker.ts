
import env from "../../env"

const prefix = env.api + "/img/";
export const Stickers = [
    prefix + "arse.jpg",
    prefix + "lying01.jpg",
    prefix + "lying04.jpg",
];

export function getStickerIndex():number {
    const count = Stickers.length;
    return Math.floor(Math.random() * count);
}