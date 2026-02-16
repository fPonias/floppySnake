
import env from "../../env"

const prefix = env.api + "/img/";
export const Stickers = [
    prefix + "hulk.jpg",
    prefix + "lying01.jpg",
    prefix + "lying05.jpg",
    prefix + "tinyHands.jpg",
    prefix + "runSnake.jpg",
    prefix + "karate.jpg"
];

export function getStickerIndex(index: number):number {
    const count = Stickers.length;
    return index % count;
}