"""
Load test for NLDC API
======================
Install:  pip install locust
Run:      locust -f locustfile.py --host https://loadcurve-production.up.railway.app

Then open http://localhost:8089
Set users = 10, spawn rate = 2, click Start
"""

from locust import HttpUser, task, between

DATE = "2026-03-11"   # ← change to a date you have in your DB

class GridUser(HttpUser):
    # each simulated user waits 1-3 seconds between requests (realistic)
    wait_time = between(1, 3)

    @task(3)
    def load_curve(self):
        """Most common request — load a single day"""
        with self.client.get(
            f"/load-curve?date={DATE}",
            name="/load-curve [single day]",
            catch_response=True
        ) as r:
            if r.status_code == 200:
                data = r.json()
                if len(data) == 96:
                    r.success()
                else:
                    r.failure(f"Expected 96 rows, got {len(data)}")
            else:
                r.failure(f"HTTP {r.status_code}")

    @task(2)
    def summary(self):
        """Summary stats for a day"""
        with self.client.get(
            f"/summary?date={DATE}",
            name="/summary",
            catch_response=True
        ) as r:
            if r.status_code == 200:
                r.success()
            else:
                r.failure(f"HTTP {r.status_code}")

    @task(1)
    def dates(self):
        """List available dates — called once on app load"""
        with self.client.get(
            "/dates",
            name="/dates",
            catch_response=True
        ) as r:
            if r.status_code == 200:
                r.success()
            else:
                r.failure(f"HTTP {r.status_code}")
