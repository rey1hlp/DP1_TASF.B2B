2026-06-18T18:01:46.241-05:00  INFO 29960 --- [genetico] [nio-8080-exec-7] c.t.planificador.sim.SimulationRegistry  : [WS][SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] Sending status to sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c status=RUNNING message=null
2026-06-18T18:01:46.304-05:00  INFO 29960 --- [genetico] [nio-8080-exec-7] c.t.planificador.sim.SimulationRegistry  : [WS][SEND] sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c type=SimulationStatusMessage bytes=105
2026-06-18T18:01:46.717-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] collapse inputs -> archivoEnvios=_uploads/b220651d-f443-47a2-9515-5f8d24d581ff airports=30
2026-06-18T18:01:50.543-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] collapse flight plans loaded=2867
2026-06-18T18:01:50.544-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] collapse block start index=0 range=20260215..20260219
...
2026-06-18T18:01:46.241-05:00  INFO 29960 --- [genetico] [nio-8080-exec-7] c.t.planificador.sim.SimulationRegistry  : [WS][SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] Sending status to sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c status=RUNNING message=null
2026-06-18T18:01:46.304-05:00  INFO 29960 --- [genetico] [nio-8080-exec-7] c.t.planificador.sim.SimulationRegistry  : [WS][SEND] sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c type=SimulationStatusMessage bytes=105
2026-06-18T18:01:46.717-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] collapse inputs -> archivoEnvios=_uploads/b220651d-f443-47a2-9515-5f8d24d581ff airports=30
2026-06-18T18:01:50.543-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] collapse flight plans loaded=2867
2026-06-18T18:01:50.544-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] collapse block start index=0 range=20260215..20260219
2026-06-18T18:02:12.396-05:00  INFO 29960 --- [genetico] [   scheduling-1] c.t.p.sim.DailyPlanningService           : [DAILY_PLAN] scheduled tick date=20260618 nowWindow=1082..1152 latestRun=id=572, start=1080, end=1150, createdAt=2026-06-18T18:00:22
2026-06-18T18:02:12.397-05:00  INFO 29960 --- [genetico] [   scheduling-1] c.t.p.sim.DailyPlanningService           : [DAILY_PLAN] scheduled tick skipped, only 2 min since last window start
2026-06-18T18:02:27.549-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] collapse block shipments=4616
2026-06-18T18:02:28.219-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:chunk] range=20260215..20260219 diaMin=20498 diaMax=20504 diasExtra=2 vuelos=25803
2026-06-18T18:02:32.715-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:chunk] result range=20260215..20260219 fitness=77650.75000000015 factible=true
2026-06-18T18:02:32.755-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationRegistry  : [SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] READY -> init broadcast pending. vuelos=4713, almacenes=30, speedMinPerSec=20.0
2026-06-18T18:02:32.755-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationRegistry  : [WS][SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] Broadcasting init to 1 session(s)
2026-06-18T18:02:32.826-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationRegistry  : [WS][SEND] sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c type=SimulationInitMessage bytes=1560620
...
2026-06-18T18:06:33.462-05:00  INFO 29960 --- [genetico] [pool-2-thread-1] c.t.planificador.sim.SimulationRegistry  : [WS][SEND] sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c type=SimulationTickMessage bytes=87
2026-06-18T18:06:33.554-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] collapse block start index=1 range=20260220..20260224
2026-06-18T18:06:33.960-05:00  INFO 29960 --- [genetico] [pool-2-thread-1] c.t.planificador.sim.SimulationRegistry  : [WS][SEND] sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c type=SimulationTickMessage bytes=87
...
2026-06-18T18:07:01.462-05:00  INFO 29960 --- [genetico] [pool-2-thread-1] c.t.planificador.sim.SimulationRegistry  : [WS][SEND] sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c type=SimulationTickMessage bytes=87
2026-06-18T18:07:01.966-05:00  INFO 29960 --- [genetico] [pool-2-thread-1] c.t.planificador.sim.SimulationRegistry  : [WS][SEND] sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c type=SimulationTickMessage bytes=87
2026-06-18T18:07:02.212-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] collapse block shipments=4957
2026-06-18T18:07:02.461-05:00  INFO 29960 --- [genetico] [pool-2-thread-1] c.t.planificador.sim.SimulationRegistry  : [WS][SEND] sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c type=SimulationTickMessage bytes=87
2026-06-18T18:07:02.867-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:chunk] range=20260220..20260224 diaMin=20503 diaMax=20509 diasExtra=2 vuelos=25803
2026-06-18T18:07:02.964-05:00  INFO 29960 --- [genetico] [pool-2-thread-1] c.t.planificador.sim.SimulationRegistry  : [WS][SEND] sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c type=SimulationTickMessage bytes=87
...
2026-06-18T18:07:05.970-05:00  INFO 29960 --- [genetico] [pool-2-thread-1] c.t.planificador.sim.SimulationRegistry  : [WS][SEND] sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c type=SimulationTickMessage bytes=87
2026-06-18T18:07:06.388-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:chunk] result range=20260220..20260224 fitness=83209.41666666685 factible=true
2026-06-18T18:07:06.410-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationRegistry  : [SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] APPEND -> vuelos=4891 almacenes=30 envios=9573 maletas=14996
2026-06-18T18:07:06.410-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationRegistry  : [WS][SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] Broadcasting append to 1 session(s)
2026-06-18T18:07:06.450-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationRegistry  : [WS][SEND] sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c type=SimulationAppendMessage bytes=1638368
2026-06-18T18:07:06.462-05:00  INFO 29960 --- [genetico] [pool-2-thread-1] c.t.planificador.sim.SimulationRegistry  : [WS][SEND] sessionId=363cafb1-45ea-e517-9fe9-8c0fddf8820c type=SimulationTickMessage bytes=87
2026-06-18T18:07:07.144-05:00  INFO 29960 --- [genetico] [pool-3-thread-1] c.t.planificador.sim.SimulationService   : [SIM:a8ebbe04-41aa-4ed9-b502-0bfeb8e6f56c] collapse waiting 240000 ms before next block

