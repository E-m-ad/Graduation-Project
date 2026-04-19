FROM python:3-slim

WORKDIR /app

COPY services/ai_recommender/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/ai_recommender/app.py ./app.py

ENV RECOMMENDER_PORT=5050

EXPOSE 5050

CMD ["python", "app.py"]
