import {FunctionDeclaration, SchemaType} from '@google/generative-ai';

const altairGraphFunctionDeclaration: FunctionDeclaration = {
    name: "render_altair",
    description: "Displays an altair graph in json format.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            json_graph: {
                type: SchemaType.STRING,
                description:
                    "JSON STRING representation of the graph to render. Must be a string, not a json object",
            },
        },
        required: ["json_graph"],
    },
};

export const functionDeclarations: FunctionDeclaration[] = [
    altairGraphFunctionDeclaration
]
