import {ZepetoScriptBehaviour} from 'ZEPETO.Script'
import {Object, GameObject} from 'UnityEngine'
import {Button} from 'UnityEngine.UI'
import {SceneManager} from 'UnityEngine.SceneManagement'
import {ZepetoWorldMultiplay} from "ZEPETO.World";
import {Room, RoomData} from "ZEPETO.Multiplay";
import {Player, State, Vector3} from "ZEPETO.Multiplay.Schema";
import * as UnityEngine from "UnityEngine";
import {CharacterState, SpawnInfo, ZepetoPlayers, CharacterInfo, CreatePlayerData} from "ZEPETO.Character.Controller";
import GameMain from './GameMain';
import * as Packets from './Packets';

//https://github.com/naverz/zepeto-multiplay-example
export default class App extends ZepetoScriptBehaviour {

    public static instance: App;
    public btn: Button;
    public multiplay: ZepetoWorldMultiplay;
    private room: Room;
    private currentPlayers: Map<string, Player> = new Map<string, Player>();

    Awake() {
        App.instance = this;
        Object.DontDestroyOnLoad(this.gameObject);
    }

    private Start() {

        console.log(`ZepetoPlayers.instance.GetHashCode(): ${ZepetoPlayers.instance.GetHashCode()}`);
        
        this.multiplay.RoomCreated += (room: Room) => {
            this.room = room;
            
            console.log('room create!!!!');
            
            this.room.AddMessageHandler("onChangedScene", (message)=>{
                var packet : Packets.change_scene = JSON.parse(message.toString());
                
                if(this.room.SessionId != packet.sessionId){
                    
                    //리모트 사이드 클라이언트 씬 전환 
                    this.ChangeScene();
                }
            });
        };

        this.multiplay.RoomJoined += (room: Room) => {
            room.OnStateChange += this.OnStateChange;
        };

        this.StartCoroutine(this.SendMessageLoop(0.1));

        this.btn.onClick.AddListener(() => {
            
            ZepetoPlayers.instance.RemovePlayer(this.room.SessionId);

            this.SendChangeScene(this.room.SessionId);
            
            this.ChangeScene();
            
        });
    }
    
    private ChangeScene(){
        var oper = SceneManager.LoadSceneAsync("GameScene");
        ZepetoPlayers.instance.ZepetoCamera.enabled = false;
        oper.completed += (ao)=>{

            console.log(ao.isDone);
            console.log(`ZepetoPlayers.instance.GetHashCode(): ${ZepetoPlayers.instance.GetHashCode()}`);

            ZepetoPlayers.instance.OnAddedLocalPlayer.AddListener(()=>{
                console.log(`added local player`);
                const myPlayer = ZepetoPlayers.instance.LocalPlayer.zepetoPlayer;
                myPlayer.character.OnChangedState.AddListener((cur, prev) => {
                    console.log(cur, prev);
                    this.SendState(cur);
                });
            });
            
            this.currentPlayers.forEach((player: Player, sessionId: string) => {

                console.log(player.zepetoHash);

                const spawnInfo = new SpawnInfo();
                const position = this.ParseVector3(player.transform.position);
                const rotation = this.ParseVector3(player.transform.rotation);
                spawnInfo.position = position;
                spawnInfo.rotation = UnityEngine.Quaternion.Euler(rotation);

                const isLocal = this.room.SessionId === player.sessionId;

                ZepetoPlayers.instance.CreatePlayerWithUserId(sessionId, player.zepetoUserId, spawnInfo, isLocal);
            });
        };
    }

    //일정 Interval Time으로 내(local)캐릭터 transform을 server로 전송합니다.
    private* SendMessageLoop(tick: number) {
        while (true) {
            yield new UnityEngine.WaitForSeconds(tick);

            if (this.room != null && this.room.IsConnected) {
                const hasPlayer = ZepetoPlayers.instance.HasPlayer(this.room.SessionId);
                
                if (hasPlayer) {
                    const myPlayer = ZepetoPlayers.instance.GetPlayer(this.room.SessionId);
                    if (myPlayer.character.CurrentState != CharacterState.Idle)
                        this.SendTransform(myPlayer.character.transform);
                }
            }
        }
    }

    private OnStateChange(state: State, isFirst: boolean) {

        // 첫 OnStateChange 이벤트 수신 시, State 전체 스냅샷을 수신합니다.
        if (isFirst) {

            // [CharacterController] (Local)Player 인스턴스가 Scene에 완전히 로드되었을 때 호출
            ZepetoPlayers.instance.OnAddedLocalPlayer.AddListener(()=>{
                const myPlayer = ZepetoPlayers.instance.LocalPlayer.zepetoPlayer;
                myPlayer.character.OnChangedState.AddListener((cur, prev) => {
                    console.log(cur, prev);
                    this.SendState(cur);
                });
            });

            // [CharacterController] Player 인스턴스가 Scene에 완전히 로드되었을 때 호출
            ZepetoPlayers.instance.OnAddedPlayer.AddListener((sessionId:string)=>{
                const isLocal = this.room.SessionId === sessionId;
                if (!isLocal) {
                    const player: Player = this.currentPlayers.get(sessionId);
                    // [RoomState] player 인스턴스의 state가 갱신될 때마다 호출됩니다.
                    player.OnChange += (changeValues) => this.OnUpdatePlayer(sessionId, player);
                }
            });
        }

        let join = new Map<string, Player>();
        let leave = new Map<string, Player>(this.currentPlayers);

        state.players.ForEach((sessionId: string, player: Player) => {
            if (!this.currentPlayers.has(sessionId)) {
                join.set(sessionId, player);
            }
            leave.delete(sessionId);
        });

        // [RoomState] Room에 입장한 player 인스턴스 생성
        join.forEach((player: Player, sessionId: string) => this.OnJoinPlayer(sessionId, player));

        // [RoomState] Room에서 퇴장한 player 인스턴스 제거
        leave.forEach((player: Player, sessionId: string) => this.OnLeavePlayer(sessionId, player));
    }

    private OnJoinPlayer(sessionId: string, player: Player) {
        console.log(`[OnJoinPlayer] players - sessionId : ${sessionId}`);
        this.currentPlayers.set(sessionId, player);

        const spawnInfo = new SpawnInfo();
        const position = this.ParseVector3(player.transform.position);
        const rotation = this.ParseVector3(player.transform.rotation);
        spawnInfo.position = position;
        spawnInfo.rotation = UnityEngine.Quaternion.Euler(rotation);

        const isLocal = this.room.SessionId === player.sessionId;
        ZepetoPlayers.instance.CreatePlayerWithUserId(sessionId, player.zepetoUserId, spawnInfo, isLocal);
    }

    private OnLeavePlayer(sessionId: string, player: Player) {
        console.log(`[OnRemove] players - sessionId : ${sessionId}`);
        this.currentPlayers.delete(sessionId);

        ZepetoPlayers.instance.RemovePlayer(sessionId);
    }

    private OnUpdatePlayer(sessionId: string, player: Player) {

        console.log(`[OnUpdatePlayer] sessionId:  ${sessionId}, zepetoHash : ${player.zepetoHash}, player.state : ${player.state}`);
        
        const position = this.ParseVector3(player.transform.position);

        const zepetoPlayer = ZepetoPlayers.instance.GetPlayer(sessionId);
        zepetoPlayer.character.MoveToPosition(position);

        if (player.state === CharacterState.Jump)
            zepetoPlayer.character.Jump();
    }

    private SendTransform(transform: UnityEngine.Transform) {
        const data = new RoomData();

        const pos = new RoomData();
        pos.Add("x", transform.localPosition.x);
        pos.Add("y", transform.localPosition.y);
        pos.Add("z", transform.localPosition.z);
        data.Add("position", pos.GetObject());

        const rot = new RoomData();
        rot.Add("x", transform.localEulerAngles.x);
        rot.Add("y", transform.localEulerAngles.y);
        rot.Add("z", transform.localEulerAngles.z);
        data.Add("rotation", rot.GetObject());
        this.room.Send("onChangedTransform", data.GetObject());
    }

    private SendState(state: CharacterState) {
        const data = new RoomData();
        console.log(state);
        data.Add("state", state);
        this.room.Send("onChangedState", data.GetObject());
    }
    
    private SendChangeScene (sessionId : string)
    {
        console.log('SendChangeScene : ' + sessionId);
        
        var packet : Packets.change_scene = new Packets.change_scene(this.room.SessionId);
        var json = JSON.stringify(packet);
        const data = new RoomData();
        data.Add("change_scene", json);
        this.room.Send("onChangedScene", data.GetObject());
    }

    private ParseVector3(vector3: Vector3): UnityEngine.Vector3 {
        return new UnityEngine.Vector3
        (
            vector3.x,
            vector3.y,
            vector3.z
        );
    }
}