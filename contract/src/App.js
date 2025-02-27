import { wrap } from './state/state';
import { Overlay } from './components/Overlay';
import {
    MPC_PATH,
    MPC_PUBLIC_KEY,
    setAccessKey,
    contractCall,
} from './utils/near-provider';
import { generateAddress } from './utils/kdf';
import { broadcast, getChange, getBalance } from './utils/bitcoin';
import './styles/app.scss';
import { useState } from 'react';

const AppComp = ({ state, update }) => {
    const query = window.location.href.split('?')[1];
    const params = query ? new URLSearchParams(query) : null;
    const contractId = params ? params.get('contractId') : null;
    const secretKey = params ? params.get('secretKey') : null;
    const from = params ? params.get('from') : null;

    const { address = 'mwVgE7n7nwtc3TtTDxN8c2gntFtVpBwBtK' } = state.app;
    const [twitterProof, setTwitterProof] = useState('');

    const handleClaim = async () => {
        try {
            update({ msg: 'claiming to ' + address }, 'overlay');

            const isSet = await setAccessKey(secretKey);
            if (!isSet) {
                window.alert('link is invalid or already used');
                update({ msg: '' }, 'overlay');
                return;
            }

            const DROP_SATS = 546;
            let funderBalance = null;
            let funderTxId = null;
            let dropChange = null;

            const { address: funderAddress } =
                await generateAddress({
                    publicKey: MPC_PUBLIC_KEY,
                    accountId: contractId,
                    path: MPC_PATH,
                    chain: 'bitcoin',
                });
            funderBalance = await getBalance({
                address: funderAddress,
            });

            const utxos = await getBalance({
                address: funderAddress,
                getUtxos: true,
            });
            funderTxId = utxos[0].txid;

            dropChange = await getChange({
                balance: funderBalance,
                sats: DROP_SATS,
            });

            console.log('claimingAddress', address);
            console.log('funderAddress', funderAddress);
            console.log('funderTxId', funderTxId);
            console.log(`funderBalance ${funderBalance}`);
            console.log('dropChange', dropChange);
            console.log('twitterProof', twitterProof);

            if (!window.confirm('continue?')) return;

            update({ msg: 'waiting for NEAR signature' }, 'overlay');

            const result = await contractCall({
                accountId: contractId,
                methodName: 'claim',
                contractId,
                args: {
                    txid_str: funderTxId,
                    vout: utxos[0].vout,
                    receiver: address,
                    change: dropChange.toString(),
                    twitter_proof: twitterProof,
                },
            });

            let signedTx;
            if (result.status?.SuccessValue) {
                const decodedValue = Buffer.from(result.status.SuccessValue, 'base64').toString();
                signedTx = decodedValue.replace(/^"|"$/g, '');
            }

            if (!signedTx) {
                throw new Error('No signed transaction found in result');
            }

            console.log('Broadcasting signed tx:', signedTx);

            update({ msg: 'broadcasting to Bitcoin network' }, 'overlay');
            const txHash = await broadcast(signedTx);
            console.log('Broadcast successful, txHash:', txHash);

            update({ msg: '' }, 'overlay');
        } catch (error) {
            console.error('Error in claim process:', error);
            window.alert('Failed to process claim: ' + error.message);
            update({ msg: '' }, 'overlay');
        }
    };

    return (
        <>
            <Overlay />
            <div className="container-fluid center">
                <section>
                    <h4>
                        You Received a Satsling Drop{from ? ` from ${from}` : ''}
                    </h4>
                    <p>Enter your address to send the asset to your account.</p>
                </section>

                <section className="input">
                    <input
                        className="form-control"
                        placeholder="bc1..."
                        value={address}
                        onChange={(e) =>
                            update({ address: e.target.value }, 'app')
                        }
                    />
                    <input
                        className="form-control mt-3"
                        placeholder="Twitter proof (base58)"
                        value={twitterProof}
                        onChange={(e) => setTwitterProof(e.target.value)}
                    />
                </section>

                <section>
                    <button
                        className="btn btn-primary"
                        onClick={handleClaim}
                    >
                        Claim
                    </button>
                </section>
            </div>
        </>
    );
};

export const App = wrap(AppComp, ['app', 'overlay']);