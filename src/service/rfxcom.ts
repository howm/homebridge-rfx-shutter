// @ts-ignore
import rfxcom, { RfxCom, Rfy } from 'rfxcom';

export interface SetupOptions {
  debug?: boolean;
}

export interface Remote {
  remoteType: string;
  deviceId: string;
  idBytes: number[];
  unitCode: number;
  randomCode: number;
  rollingCode: number;
}

export enum BlindAction {
  UP = 'up',
  DOWN = 'down',
  STOP = 'stop',
}

let rfxtrx: RfxCom | null;
let rfy: Rfy | null;

export function setup(
  device: string,
  { debug = true }: SetupOptions = {},
): RfxCom {
  rfxtrx = new rfxcom.RfxCom(device, { debug });
  rfy = new rfxcom.Rfy(rfxtrx, rfxcom.rfy.RFY);
  return rfxtrx;
}

export function listRemotes(): Promise<Remote[]> {
  if (!rfxtrx) throw new Error('Missing setup');

  return new Promise((resolve: Function): void => {
    rfxtrx.once('rfyremoteslist', resolve);

    rfxtrx.initialise((): void => {
      console.info('Device initialised, listing remotes');
      rfy.listRemotes();
    });
  });
}

export function fireShutterAction(deviceId: string, action: BlindAction): void {
  if (!rfy) throw new Error('Missing setup');

  rfy[action](deviceId);
}
