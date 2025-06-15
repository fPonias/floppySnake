
import env from "../../env"

const prefix = env.api + "/img/";
export const Stickers = [
    prefix + "bitchPudding.jpg",
    prefix + "he man.png",
    prefix + "hulk.jpg",
    prefix + "Starscream.jpeg",
    prefix + "lying01.jpg",
    prefix + "lying05.jpg",
];

export function getStickerIndex(index: number):number {
    const count = Stickers.length;
    return index % count;
}