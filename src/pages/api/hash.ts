import type { NextApiRequest, NextApiResponse } from 'next';
import { Hasher } from '@doko-js/wasm';

type ResponseData = {
    hash: string;
    success: boolean;
    error?: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            hash: '',
            error: 'Method not allowed'
        });
    }

    try {
        const { player, pool_id } = req.body;

        // Validate input
        if (!player || !pool_id) {
            return res.status(400).json({
                success: false,
                hash: '',
                error: 'Missing player or pool_id parameter'
            });
        }

        // Generate the hash using the WASM module
        const result = Hasher.hash(
            "bhp256", // algorithm
            `{player: ${player}, pool_id: ${pool_id}u64}`, // input value
            "field", // output type
            "mainnet"
        );

        // Return the generated hash
        return res.status(200).json({
            success: true,
            hash: result
        });
    } catch (error) {
        console.error('Hash generation error:', error);
        return res.status(500).json({
            success: false,
            hash: '',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
} 