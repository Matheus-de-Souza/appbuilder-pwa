import { readFileSync } from 'fs';
import jsdom from 'jsdom';
import path from 'path';
import { Task, TaskOutput } from './Task';

/**
 * TODO:
 * Backgroud images?
 * Layouts?
 * Styles?
 */
type HTML = string;

type BookCollectionAudio = {
    num: number;
    src: string;
    len: number;
    size: number;
    filename: string;
    timingFile: string;
};

type BookCollection = {
    id: string;
    features: any;
    books: {
        id: string;
        name: string;
        abbreviation: string;
        testament: string;
        section: string; // Pentateuch
        chapters: number;
        chaptersN: string; // 1-34
        file: string;
        audio: BookCollectionAudio[];
    }[];
    style?: {
        font: string;
        textSize: number;
        lineHeight: number;
        textDirection: string;
        numeralSystem: string;
        verseNumbers: string;
    };
    languageCode: string;
    languageName: string;
    footer?: HTML; //
    meta?: {
        [key: string]: string;
    };
    styles?: {
        [selector: string]: {
            [property: string]: string;
        };
    };
    collectionName: string;
    collectionAbbreviation: string;
    collectionDescription: string;
};

export type ConfigData = {
    name?: string;
    mainFeatures?: any;
    fonts?: {
        name: string;
        family: string;
        file: string;
        fontWeight: string;
        fontStyle: string;
    }[];
    themes?: {
        name: string;
        enabled: boolean;
        colorSets: {
            type: string;
            colors: {
                [key: string]: string;
            };
        }[];
    }[];
    defaultTheme?: string;
    traits?: any;
    bookCollections?: BookCollection[];
    translationMappings?: {
        [key: string]: {
            [lang: string]: string;
        };
    };
    keys?: string[];
    about?: string; // TODO
    analytics?: {
        // TODO
        id: string;
        name: string;
        type: string;
    }[];
    audio?: {
        sources: {
            [key: string]: {
                type: string;
                name: string;
                accessMethods?: string[];
                folder?: string;
                key?: string;
                damId?: string;
                address?: string;
            };
        };
    };
    videos?: {
        // TODO
        id: string;
        width: number;
        height: number;
        title: string;
        thumbnail: string;
        onlineUrl: string;
        placement: {
            pos: string;
            ref: string;
            collection: number;
        };
    };
    layouts?: {
        // TODO
        mode: string;
        enabled: boolean;
        features?: {
            [key: string]: any;
        };
    }[];
    defaultLayout?: string; // TODO
    security?: {
        // TODO
        features?: {
            [key: string]: any;
        };
        pin: string;
        mode: string;
    };
};

const data: ConfigData = {};

function parseConfigValue(value: any) {
    if (!value.includes(':') && !isNaN(parseInt(value))) value = parseInt(value);
    else if (['true', 'false'].includes(value)) value = value === 'true' ? true : false;
    // else {} // " " split array, string, enum or time
    return value;
}

function convertConfig(dataDir: string, verbose: boolean) {
    const dom = new jsdom.JSDOM(readFileSync(path.join(dataDir, 'appdef.xml')).toString());
    const { document } = dom.window;

    // Name
    data.name = document.getElementsByTagName('app-name')[0].innerHTML;
    if (verbose) console.log(`Converting ${data.name}...`);

    // Features
    const mainFeatureTags = document
        .querySelector('features[type=main]')
        ?.getElementsByTagName('e');
    if (!mainFeatureTags) throw new Error('Features tag not found in xml');
    data.mainFeatures = {};

    for (const tag of mainFeatureTags) {
        try {
            const value: any = tag.attributes.getNamedItem('value')!.value;
            data.mainFeatures[tag.attributes.getNamedItem('name')!.value] = parseConfigValue(value);
        } catch (e) {
            if (e instanceof ReferenceError) {
                console.error(
                    'The main features section did not have the expected attributes `name` and `value`'
                );
            } else throw e;
        }
    }
    if (verbose) console.log(`Converted ${Object.keys(data.mainFeatures).length} features`);

    // Fonts
    const fontTags = document.getElementsByTagName('fonts')[0].getElementsByTagName('font');
    data.fonts = [];

    for (const tag of fontTags) {
        data.fonts.push({
            family: tag.attributes.getNamedItem('family')!.value,
            name: tag.getElementsByTagName('font-name')[0].innerHTML,
            file: tag.getElementsByTagName('f')[0].innerHTML,
            fontStyle: tag
                .querySelector('sd[property=font-style]')!
                .attributes.getNamedItem('value')!.value,
            fontWeight: tag
                .querySelector('sd[property=font-weight]')!
                .attributes.getNamedItem('value')!.value
        });
    }
    if (verbose) console.log(`Converted ${data.fonts.length} fonts`);

    // Color themes
    const colorThemeTags = document
        .getElementsByTagName('color-themes')[0]
        .getElementsByTagName('color-theme');
    const colorSetTags = document.getElementsByTagName('colors');
    data.themes = [];

    for (const tag of colorThemeTags) {
        const theme = tag.attributes.getNamedItem('name')!.value;
        data.themes.push({
            name: theme,
            enabled: tag.attributes.getNamedItem('enabled')?.value === 'true',
            colorSets: Array.from(colorSetTags).map((cst) => {
                const colorTags = cst.getElementsByTagName('color');
                const colors: { [key: string]: string } = {};
                for (const color of colorTags) {
                    const cm = color.querySelector(`cm[theme="${theme}"]`);
                    const name = color.getAttribute('name');
                    const value = cm?.getAttribute('value');
                    if (name && value) colors[name] = value;
                }
                return {
                    type: cst.getAttribute('type')!,
                    colors: colors
                };
            })
        });
        if (tag.attributes.getNamedItem('default')?.value === 'true')
            data.defaultTheme = data.themes[data.themes.length - 1].name;
    }
    if (verbose) console.log(`Converted ${data.themes.length} themes`);

    // Traits
    const traitTags = document.getElementsByTagName('traits')[0].getElementsByTagName('trait');
    data.traits = {};

    for (const tag of traitTags) {
        data.traits[tag.attributes.getNamedItem('name')!.value] =
            tag.attributes.getNamedItem('value')?.value;
    }
    if (verbose) console.log(`Converted ${Object.keys(data.traits).length} traits`);

    // Book collections
    const booksTags = document.getElementsByTagName('books');
    data.bookCollections = [];

    for (const tag of booksTags) {
        const featuresTags = tag.querySelector('features[type=bc]')?.getElementsByTagName('e');
        if (!featuresTags) throw 'Book collection feature tags missing';
        const features: any = {};
        for (const feature of featuresTags) {
            features[feature.attributes.getNamedItem('name')!.value] = parseConfigValue(
                feature.attributes.getNamedItem('value')!.value
            );
        }
        const books: BookCollection['books'] = [];
        const bookTags = tag.getElementsByTagName('book');
        for (const book of bookTags) {
            const audio: BookCollectionAudio[] = [];
            for (const page of book.getElementsByTagName('page')) {
                const audioTag = page.getElementsByTagName('audio')[0];
                if (!audioTag) continue;
                const fTag = audioTag.getElementsByTagName('f')[0];
                audio.push({
                    num: parseInt(page.attributes.getNamedItem('num')!.value),
                    filename: fTag.innerHTML,
                    len: parseInt(fTag.attributes.getNamedItem('len')!.value),
                    size: parseInt(fTag.attributes.getNamedItem('size')!.value),
                    src: fTag.attributes.getNamedItem('src')!.value,
                    timingFile: audioTag.getElementsByTagName('y')[0].innerHTML
                });
            }
            books.push({
                chapters: parseInt(
                    book.getElementsByTagName('ct')[0].attributes.getNamedItem('c')!.value
                ),
                chaptersN: book.getElementsByTagName('cn')[0].attributes.getNamedItem('value')!
                    .value,
                id: book.attributes.getNamedItem('id')!.value,
                name: book.getElementsByTagName('n')[0]?.innerHTML,
                section: book.getElementsByTagName('sg')[0]?.innerHTML,
                testament: book.getElementsByTagName('g')[0]?.innerHTML,
                abbreviation: book.getElementsByTagName('v')[0]?.innerHTML,
                audio,
                file: book.getElementsByTagName('f')[0]?.innerHTML.replace(/\.\w*$/, '.usfm')
            });
        }
        const stylesTag = tag.getElementsByTagName('styles-info')[0];
        const writingSystem = tag.getElementsByTagName('writing-system')[0];
        const collectionNameTags = tag.getElementsByTagName('book-collection-name');
        const collectionName = collectionNameTags.length > 0 ? collectionNameTags[0].innerHTML : '';
        const collectionDescriptionTags = tag.getElementsByTagName('book-collection-description');
        const collectionDescription =
            collectionDescriptionTags.length > 0 ? collectionDescriptionTags[0].innerHTML : '';
        const collectionAbbreviationTags = tag.getElementsByTagName('book-collection-abbrev');
        const collectionAbbreviation =
            collectionAbbreviationTags.length > 0 ? collectionAbbreviationTags[0].innerHTML : '';
        console.log(writingSystem.innerHTML);
        data.bookCollections.push({
            id: tag.id,
            collectionName,
            collectionAbbreviation,
            collectionDescription,
            features,
            books,
            languageCode: writingSystem.attributes.getNamedItem('code')!.value,
            languageName: writingSystem
                .getElementsByTagName('display-names')[0]
                ?.getElementsByTagName('form')[0].innerHTML,
            style: {
                font: stylesTag
                    .getElementsByTagName('text-font')[0]
                    .attributes.getNamedItem('family')!.value,
                lineHeight: parseInt(
                    stylesTag
                        .getElementsByTagName('line-height')[0]
                        .attributes.getNamedItem('value')!.value
                ),
                numeralSystem: stylesTag
                    .getElementsByTagName('numeral-system')[0]
                    .attributes.getNamedItem('value')!.value,
                textDirection: stylesTag
                    .getElementsByTagName('text-direction')[0]
                    .attributes.getNamedItem('value')!.value,
                textSize: parseInt(
                    stylesTag.getElementsByTagName('text-size')[0].attributes.getNamedItem('value')!
                        .value
                ),
                verseNumbers: stylesTag
                    .getElementsByTagName('verse-number-style')[0]
                    .attributes.getNamedItem('value')!.value
            }
        });
    }
    if (verbose)
        console.log(
            `Converted ${data.bookCollections.length} book collections with [${data.bookCollections
                .map((x) => x.books.length)
                .join(', ')}] books`
        );

    // Menu localizations
    data.translationMappings = {};
    const translationMappingsTags = document
        .getElementsByTagName('translation-mappings')[0]
        .getElementsByTagName('tm');

    for (const tag of translationMappingsTags) {
        const localizations: typeof data.translationMappings.key = {};
        for (const localization of tag.getElementsByTagName('t')) {
            localizations[localization.attributes.getNamedItem('lang')!.value] =
                localization.innerHTML;
        }
        data.translationMappings[tag.id] = localizations;
    }
    if (verbose)
        console.log(
            `Converted ${Object.keys(data.translationMappings).length} translation mappings`
        );

    // Keys
    if (document.getElementsByTagName('keys').length > 0) {
        data.keys = Array.from(
            document.getElementsByTagName('keys')[0].getElementsByTagName('key')
        ).map((key) => key.innerHTML);
        if (verbose) console.log(`Converted ${data.keys.length} keys`);
    }

    /* about?: string; */

    /*
    analytics?: {
        id: string;
        name: string;
        type: string;
    }[];
    */

    // Audio Sources
    const audioSources = document
        .getElementsByTagName('audio-sources')[0]
        .getElementsByTagName('audio-source');
    if (audioSources?.length > 0) {
        data.audio = { sources: {} };
        for (const source of audioSources) {
            const id = source.getAttribute('id')!.toString();
            const type = source.getAttribute('type')!.toString();
            const name = source.getElementsByTagName('name')[0].innerHTML;
            data.audio.sources[id] = {
                type: type,
                name: name
            };
            if (type === 'assets') continue;
            else {
                data.audio.sources[id].accessMethods = source
                    .getElementsByTagName('access-methods')[0]
                    .getAttribute('value')!
                    .toString()
                    .split('|');
                data.audio.sources[id].folder = source.getElementsByTagName('folder')[0].innerHTML;

                if (type === 'download')
                    data.audio.sources[id].address =
                        source.getElementsByTagName('address')[0].innerHTML;
                else if (type === 'fcbh') {
                    data.audio.sources[id].key = source.getElementsByTagName('key')[0].innerHTML;
                    data.audio.sources[id].damId =
                        source.getElementsByTagName('dam-id')[0].innerHTML;
                }
            }
        }
    }
    if (verbose) console.log(`Converted ${audioSources?.length} audio sources`);

    /*
    videos?: {
        id: string;
        width: number;
        height: number;
        title: string;
        thumbnail: string;
        onlineUrl: string;
        placement: {
            pos: string;
            ref: string;
            collection: number;
        };
    };
    */

    /*
    layouts?: {
        mode: string;
        enabled: boolean;
        features?: {
            [key: string]: any;
        };
    }[];
    */

    /* defaultLayout?: string; */

    /*
    security?: {
        features?: {
            [key: string]: any;
        };
        pin: string;
        mode: string;
    };
    */

    return data;
}

export interface ConfigTaskOutput extends TaskOutput {
    data: ConfigData;
}

/**
 * Converts appdef.xml into a config object which is passed to other conversion functions
 * and is also written to src/config.js.
 */
export class ConvertConfig extends Task {
    public triggerFiles: string[] = ['appdef.xml'];
    public run(verbose: boolean): ConfigTaskOutput {
        const data = convertConfig(this.dataDir, verbose);
        return {
            taskName: 'ConvertConfig',
            data,
            files: [
                {
                    path: 'src/config.js',
                    content: `export default ${JSON.stringify(data)};`
                }
            ]
        };
    }
}
