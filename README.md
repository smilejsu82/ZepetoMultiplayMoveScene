# zepeto-multiplay-change-scene

제페토 멀티 플레이 씬 전환 데모 프로젝트 입니다 </br>
프로젝트를 실행하고 제페토 로그인을 해주세요 <br/>
에디터에서 테스트 하실분들은 Environments > Create Custom Environment를 선택후 새 환경을 만들고 Multiplay Port를 마스터 클라이언트의 port와 동일하게 설정합니다 <br/>
각 에디터의 로그인된 제페토 아이디가 달라야 합니다
<br/><br/>

## Overview

[ZEPETO Multiplay](https://studio.zepeto.me/kr/guides/multiplay)와 [Character Controller](https://studio.zepeto.me/kr/guides/character-control) 기반으로 작성된 예제입니다.
<br/><br/>

## 버튼을 눌러 씬 전환

클라이언트에서 버튼을 눌러 씬을 전환 하게 테스트 할수 있도록 만들어 놨습니다

```typescript
this.btn.onClick.AddListener(() => {
  ZepetoPlayers.instance.RemovePlayer(this.room.SessionId);

  this.SendChangeScene(this.room.SessionId);

  this.ChangeScene();
});
```

<br/>

## 씬 전환 하기

비동기를 메서드를 사용해 씬을 로드 합니다 <br/>
로드가 끝나면 플레이어들을 다시 생성 합니다
이때 로컬 플레이어가 로드된후 OnChangedState에 이벤트를 등록 하지 않으면 state가 업데이트 되지 않으니 주의 해주세요<br/>

```typescript
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
```
