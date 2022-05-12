declare module "ZEPETO.Multiplay.Schema" {

	import { Schema, MapSchema, ArraySchema } from "@colyseus/schema"; 


	interface State extends Schema {
		players: MapSchema<Player>;
	}
	class Vector3 extends Schema {
		x: number;
		y: number;
		z: number;
	}
	class Transform extends Schema {
		position: Vector3;
		rotation: Vector3;
	}
	class Player extends Schema {
		sessionId: string;
		zepetoHash: string;
		zepetoUserId: string;
		transform: Transform;
		state: number;
	}
}