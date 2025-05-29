
import env from "../../env"

const prefix = env.api + "/img/";
export const Stickers = [
    prefix + "runningMouf.jpg",
    prefix + "chickenLegs.jpg",
    prefix + "actionFigure.jpg",
    prefix + "snek.jpg",
    prefix + "borg.jpg",
    prefix + "barney.jpg",
];

export function getStickerIndex(index: number):number {
    const count = Stickers.length;
    return index % count;
}